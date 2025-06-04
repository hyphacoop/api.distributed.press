import { createHelia, libp2pDefaults } from 'helia'
import { unixfs } from '@helia/unixfs'
import { ipns } from '@helia/ipns'
import { FsDatastore } from 'datastore-fs'
import { FsBlockstore } from 'blockstore-fs'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { autoTLS } from '@ipshipyard/libp2p-auto-tls'
import { autoNAT } from '@libp2p/autonat'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { webRTCDirect } from '@libp2p/webrtc'
import { bootstrap } from '@libp2p/bootstrap'
import {
  generateKeyPair,
  privateKeyFromProtobuf,
  privateKeyToProtobuf
} from '@libp2p/crypto/keys'
import type { PrivateKey } from '@libp2p/interface'
import { createFromPrivKey } from '@libp2p/peer-id-factory'
import { CID } from 'multiformats/cid'
import path from 'path'
import { promises as fsPromises, createReadStream } from 'fs'
import { Readable } from 'stream'
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
  useWebRTC?: boolean
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
  ipfsFs: any | null
  ipns: any | null

  constructor (options: IPFSProtocolOptions) {
    this.options = { ...options, useWebRTC: options.useWebRTC ?? false }
    this.onCleanup = []
    this.helia = null
    this.ipfsFs = null
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
        ]
      },
      transports: [
        tcp(),
        webSockets(),
        ...(this.options.useWebRTC === true ? [webRTCDirect()] : [])
      ],
      services: {
        autoNAT: autoNAT(),
        autoTLS: autoTLS(),
        dht: kadDHT({
          validators: {
            ipns: ipnsValidator
          },
          selectors: {
            ipns: ipnsSelector
          },
          clientMode: true,
          allowQueryWithZeroPeers: true
        }),
        identify: identify(),
        identifyPush: identifyPush(),
        ping: ping(),
        keychain: keychain()
      },
      peerDiscovery: [bootstrap(bootstrapConfig)]
    }

    this.helia = await createHelia({ datastore, blockstore, libp2p: libp2pOptions })
    this.ipfsFs = unixfs(this.helia)
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
    const timerLabel = `IPFS Sync - ${id}` // Unique label per site
    console.time(timerLabel) // Start total sync timer
    ctx?.logger.info('[ipfs] Sync Start')
    if (this.helia == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }

    // Create a fresh UnixFS instance for this sync operation
    const ipfsFs = unixfs(this.helia)
    ctx?.logger.info('[ipfs] Created fresh UnixFS instance for sync')

    // Read directory contents first to verify what we're about to add
    const files = await fsPromises.readdir(folderPath)
    const fileContents = new Map<string, string>()
    for (const file of files) {
      const fullPath = path.join(folderPath, file)
      try {
        const content = await fsPromises.readFile(fullPath, 'utf8')
        fileContents.set(file, content)
        ctx?.logger.info(`[ipfs] Read file ${file} (${content.length} bytes)`)
      } catch (err) {
        ctx?.logger.error(`[ipfs] Error reading file ${file}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const cid = await this.addDirectory(folderPath, ctx, ipfsFs)
    console.timeLog(timerLabel, 'Directory Added') // Log after directory
    ctx?.logger.info(`[ipfs] Added directory with CID ${cid.toString()} (type: ${typeof cid})`)

    const { publishKey, cid: publishedCid } = await this.publishSite(id, cid, ctx)
    console.timeLog(timerLabel, 'Site Published') // Log after publish
    ctx?.logger.info(`[ipfs] Published CID comparison - Original: ${cid.toString()}, Published: ${publishedCid}`)
    const subdomain = id.replace(/-/g, '--').replace(/\./g, '-')

    console.timeEnd(timerLabel) // End total sync timer
    return {
      enabled: true,
      link: `ipns://${id}/`,
      gateway: `https://${subdomain}.ipns.ipfs.hypha.coop`,
      cid: publishedCid,
      pubKey: `ipns://${publishKey}/`,
      dnslink: `/ipns/${publishKey}/`
    }
  }

  async addDirectory (folderPath: string, ctx?: Ctx, ipfsFs?: any): Promise<CID> {
    ctx?.logger.info(`[ipfs] Attempting to add directory at path: ${folderPath}`)
    
    try {
      const files = await fsPromises.readdir(folderPath)
      ctx?.logger.info(`[ipfs] Found ${files.length} files in directory: ${files.join(', ')}`)
      
      if (files.length === 0) {
        ctx?.logger.warn(`[ipfs] No files found in directory: ${folderPath}`)
        return CID.parse('bafyaabakaieac')
      }

      const entries: Array<{ path: string, cid: CID }> = []
      for (const file of files) {
        const fullPath = path.join(folderPath, file)
        try {
          const stat = await fsPromises.stat(fullPath)
          if (stat.isFile()) {
            ctx?.logger.info(`[ipfs] Processing file: ${file} (${stat.size} bytes) at ${fullPath}`)
            // Read file content for verification
            const content = await fsPromises.readFile(fullPath, 'utf8')
            ctx?.logger.info(`[ipfs] File content hash: ${Buffer.from(content).toString('hex').slice(0, 16)}...`)
            
            // Create a readable stream for the file
            const stream = createReadStream(fullPath)
            // Add the file to IPFS with path and content
            const cid = await ipfsFs.addFile({
              path: file, // Use the filename as the path
              content: stream
            }, { cidVersion: 1 }) as CID
            entries.push({ path: file, cid })
            ctx?.logger.info(`[ipfs] Successfully added file ${file} => ${cid.toString()}`)
          } else {
            ctx?.logger.warn(`[ipfs] Skipping non-file entry: ${file} (is directory: ${stat.isDirectory()})`)
          }
        } catch (err) {
          ctx?.logger.error(`[ipfs] Error processing file ${file}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      if (entries.length === 0) {
        ctx?.logger.warn('[ipfs] No valid files were processed, returning empty directory CID')
        return CID.parse('bafyaabakaieac')
      }

      // Convert entries array to object mapping filenames to CIDs
      const dirEntries = Object.fromEntries(
        entries.map(entry => [entry.path, entry.cid])
      )

      ctx?.logger.info(`[ipfs] Creating directory with ${entries.length} entries: ${entries.map(e => `${e.path} => ${e.cid.toString()}`).join(', ')}`)
      // Use unixfs API format - object mapping filenames to CIDs
      const dirCid = await ipfsFs.addDirectory(dirEntries)
      ctx?.logger.info(`[ipfs] Created directory with CID: ${dirCid.toString()}`)
      return dirCid
    } catch (err) {
      ctx?.logger.error(`[ipfs] Error reading directory ${folderPath}: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  async publishSite (id: string, cid: CID, ctx?: Ctx): Promise<PublishResult> {
    const name = `dp-site-${id}`
    let privateKey: PrivateKey | null = await this.loadKey(name)

    if (privateKey == null) {
      privateKey = await generateKeyPair('Ed25519')
      await this.saveKey(name, privateKey)
    }

    ctx?.logger.info(`[ipfs] Publishing CID ${cid.toString()} (type: ${typeof cid}, isValidCID: ${!!CID.asCID(cid)}}) to IPNS with key ${name}`)
    await this.ipns.publish(privateKey, cid, { signal: AbortSignal.timeout(5000) })
    ctx?.logger.info(`[ipfs] Successfully published to IPNS, verifying resolution...`)
    
    // Verify the published value
    const peerId = await createFromPrivKey(privateKey)
    const ipnsName = `/ipns/${peerId.toString()}`
    try {
      const resolved = await this.ipns.resolve(ipnsName)
      ctx?.logger.info(`[ipfs] IPNS resolution check - Published: ${cid.toString()}, Resolved: ${resolved.toString()}`)
    } catch (err) {
      ctx?.logger.error(`[ipfs] IPNS resolution check failed: ${err instanceof Error ? err.message : String(err)}`)
    }

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

    const peerId = await createFromPrivKey(privateKey)
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
      const raw = await fsPromises.readFile(keyPath)
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
    await fsPromises.writeFile(keyPath, new Uint8Array(pb))
  }
}
