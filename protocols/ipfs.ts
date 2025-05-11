import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { ipns } from '@helia/ipns'
import { FsDatastore } from 'datastore-fs'
import { FsBlockstore } from 'blockstore-fs'
import { kadDHT } from '@libp2p/kad-dht'
import { identify } from '@libp2p/identify'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { uPnPNAT } from '@libp2p/upnp-nat'
import { autoNAT } from '@libp2p/autonat'
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
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'

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
    const datastorePath = path.join(this.options.path, 'datastore')
    const blockstorePath = path.join(this.options.path, 'blockstore')
    const datastore = new FsDatastore(datastorePath)
    const blockstore = new FsBlockstore(blockstorePath)

    const libp2pConfig = {
      services: {
        autoNAT: autoNAT(),
        dht: kadDHT({ validators: { ipns: ipnsValidator }, selectors: { ipns: ipnsSelector } }),
        identify: identify(),
        keychain: keychain(),
        ping: ping(),
        relay: circuitRelayServer(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
        upnp: uPnPNAT()
      }
    }

    this.helia = await createHelia({ datastore, blockstore, libp2p: libp2pConfig })
    this.fs = unixfs(this.helia)
    this.ipns = ipns(this.helia)

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
    ctx?.logger.info('[ipfs] Sync Start')
    if (this.helia == null || this.fs == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }

    const cid = await this.addDirectory(folderPath, ctx)
    ctx?.logger.info(`[ipfs] Added directory with CID ${cid.toString()}`)

    const { publishKey, cid: publishedCid } = await this.publishSite(id, cid, ctx)
    const subdomain = id.replaceAll('-', '--').replaceAll('.', '-')

    return {
      enabled: true,
      link: `ipns://${publishKey}/`,
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
        const cid = await this.fs.addBytes(data, { cidVersion: 1 }) as CID
        entries.push({ path: file, cid })
        ctx?.logger.debug(`[ipfs] Added file ${file} => ${cid.toString()}`)
      }
    }
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
