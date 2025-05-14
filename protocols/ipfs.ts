import { createHelia, libp2pDefaults } from 'helia'
import { unixfs } from '@helia/unixfs'
import { ipns } from '@helia/ipns'
import { FsDatastore } from 'datastore-fs'
import { FsBlockstore } from 'blockstore-fs'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'
import { bootstrap } from '@libp2p/bootstrap'
import {
  generateKeyPair,
  privateKeyFromProtobuf,
  privateKeyToProtobuf
} from '@libp2p/crypto/keys'
import type { PrivateKey } from '@libp2p/interface'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'
import path from 'path'
import fs from 'fs'
import makeDir from 'make-dir'
import createError from 'http-errors'
import { Static } from '@sinclair/typebox'
import Protocol, { Ctx, SyncOptions, ProtocolStats } from './interfaces.js'
import { IPFSProtocolFields } from '../api/schemas.js'
import getPort from 'get-port'

// https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/bootstrappers.ts
const bootstrapConfig = {
  list: [
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
    '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
    '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ'
  ]
}

export interface IPFSProtocolOptions {
  path: string
}

export interface PublishResult {
  cid: string
  publishKey: string
}

type CleanupCallback = () => Promise<void>

export class IPFSProtocol implements Protocol<Static<typeof IPFSProtocolFields>> {
  options: IPFSProtocolOptions
  onCleanup: CleanupCallback[]
  helia: any | null
  fs: any | null
  ipns: any | null

  constructor (options: IPFSProtocolOptions) {
    this.options = options
    this.onCleanup = []
    this.helia = null
    this.fs = null
    this.ipns = null
  }

  async load (): Promise<void> {
    console.time('Helia Initialization') // Start timing
    const datastorePath = path.join(this.options.path, 'datastore')
    const blockstorePath = path.join(this.options.path, 'blockstore')
    const datastore = new FsDatastore(datastorePath)
    const blockstore = new FsBlockstore(blockstorePath)

    const tcpPort = await getPort({ port: 7976 })
    const wsPort = await getPort({ port: 7977 })

    // Default libp2p config: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/libp2p-defaults.ts
    const libp2pOptions = {
      ...libp2pDefaults(),
      addresses: {
        listen: [
          `/ip4/0.0.0.0/tcp/${tcpPort}`,
          `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
          `/ip6/::/tcp/${tcpPort}`,
          `/ip6/::/tcp/${wsPort}/ws`,
          '/p2p-circuit'
          // Uncomment below if WebRTC Direct is needed
          // `/ip4/0.0.0.0/udp/${tcpPort}/webrtc-direct`,
          // `/ip6/::/udp/${tcpPort}/webrtc-direct`,
        ]
      },
      services: {
        identify: identify(),
        keychain: keychain(),
        ping: ping()
      },
      peerDiscovery: [bootstrap(bootstrapConfig)]
    }

    this.helia = await createHelia({ datastore, blockstore, libp2p: libp2pOptions })
    this.fs = unixfs(this.helia)
    this.ipns = ipns(this.helia)
    console.timeEnd('Helia Initialization') // Log init time

    this.onCleanup.push(async () => {
      await this.helia.stop()
    })
  }

  async unload (): Promise<void> {
    for (const onCleanup of this.onCleanup) {
      await onCleanup()
    }
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof IPFSProtocolFields>> {
    console.time('IPFS Sync') // Start total sync timer
    ctx?.logger.info('[ipfs] Sync Start')
    if (this.helia == null || this.fs == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }

    const cid = await this.addDirectory(folderPath, ctx)
    console.timeLog('IPFS Sync', 'Directory Added') // Log after directory
    ctx?.logger.info(`[ipfs] Added directory with CID ${cid.toString()}`)

    const { publishKey, cid: publishedCid } = await this.publishSite(id, cid, ctx)
    console.timeLog('IPFS Sync', 'Site Published') // Log after publish
    const subdomain = id.replaceAll('-', '--').replaceAll('.', '-')

    console.timeEnd('IPFS Sync') // End total sync timer
    return {
      enabled: true,
      link: `ipns://${id}/`,
      gateway: `https://${subdomain}.ipns.ipfs.hypha.coop`,
      cid: publishedCid,
      pubKey: `ipns://${publishKey}/`,
      dnslink: `/ipns/${publishKey}/`
    }
  }

  async addDirectory (folderPath: string, ctx?: Ctx): Promise<CID> {
    const files = await fs.promises.readdir(folderPath)
    if (files.length === 0) return CID.parse('bafyaabakaieac')

    const entries: Array<{ path: string, cid: CID }> = []
    for (const file of files) {
      const fullPath = path.join(folderPath, file)
      const stat = await fs.promises.stat(fullPath)
      if (stat.isFile()) {
        const data = await fs.promises.readFile(fullPath)
        console.log(`Content of ${file}:`, data.toString()) // Log file content
        const cid = await this.fs.addBytes(data, { cidVersion: 1 }) as CID
        entries.push({ path: file, cid })
        ctx?.logger.debug(`[ipfs] Added file ${file} => ${cid.toString()}`)
      }
    }
    console.log('Directory Entries:', entries) // Log entries before adding
    return this.fs.addDirectory(entries, { cidVersion: 1 })
  }

  async publishSite (id: string, cid: CID, ctx?: Ctx): Promise<PublishResult> {
    const name = `dp-site-${id}`
    let privateKey: PrivateKey | null = await this.loadKey(name)

    if (privateKey == null) {
      privateKey = await generateKeyPair('Ed25519')
      await this.saveKey(name, privateKey)
    }

    ctx?.logger.info(`[ipfs] Publishing CID ${cid.toString()} to IPNS with key ${name}`)
    await this.ipns.publish(privateKey, cid, { signal: AbortSignal.timeout(5000) })

    const peerId = peerIdFromPrivateKey(privateKey)
    return { publishKey: peerId.toString(), cid: cid.toString() }
  }

  async unsync (id: string, _: Static<typeof IPFSProtocolFields>, ctx?: Ctx): Promise<void> {
    if (this.helia == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }
    const name = `dp-site-${id}`
    const privateKey = await this.loadKey(name)
    if (privateKey != null) {
      const EMPTY = CID.parse('bafyaabakaieac')
      await this.ipns.publish(privateKey, EMPTY, { signal: AbortSignal.timeout(5000) })
      ctx?.logger.info(`[ipfs] Unsynced ${id}`)
    } else {
      ctx?.logger.warn(`[ipfs] No key for ${id}`)
    }
  }

  async stats (id: string): Promise<ProtocolStats> {
    if (this.helia == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }
    const name = `dp-site-${id}`
    const privateKey = await this.loadKey(name)
    if (privateKey == null) throw createError(404, `No key for ${id}`)

    const peerId = peerIdFromPrivateKey(privateKey)
    const ipnsName = `/ipns/${peerId.toString()}`
    try {
      const resolved = await this.ipns.resolve(ipnsName)
      let count = 0
      for await (const provider of this.helia.libp2p.services.dht.findProviders(resolved)) {
        void provider
        count++
      }
      return { peerCount: count }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('IPNS record not found')) {
        return { peerCount: 0 }
      }
      throw e
    }
  }

  getKeyPath (name: string): string {
    return path.join(this.options.path, 'keys', `${name}.key`)
  }

  async loadKey (name: string): Promise<PrivateKey | null> {
    const keyPath = this.getKeyPath(name)
    try {
      const raw = await fs.promises.readFile(keyPath)
      return privateKeyFromProtobuf(new Uint8Array(raw))
    } catch (err: any) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }

  async saveKey (name: string, privateKey: PrivateKey): Promise<void> {
    const keyPath = this.getKeyPath(name)
    await makeDir(path.dirname(keyPath))
    const pb = privateKeyToProtobuf(privateKey)
    await fs.promises.writeFile(keyPath, Buffer.from(pb))
  }
}
