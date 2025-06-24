import { createHelia, libp2pDefaults } from 'helia'
import { unixfs } from '@helia/unixfs'
import { ipns } from '@helia/ipns'
import { FsDatastore } from 'datastore-fs'
import { FsBlockstore } from 'blockstore-fs'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { autoTLS } from '@ipshipyard/libp2p-auto-tls'
import { autoNAT } from '@libp2p/autonat'
import { uPnPNAT } from '@libp2p/upnp-nat'
import { dcutr } from '@libp2p/dcutr'
import { identify, identifyPush } from '@libp2p/identify'
// import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
// import { delegatedHTTPRoutingDefaults } from '@helia/routers'
import { kadDHT, removePrivateAddressesMapper } from '@libp2p/kad-dht'
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
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { base36 } from 'multiformats/bases/base36'

// https://github.com/libp2p/js-libp2p-amino-dht-bootstrapper/blob/main/src/utils/default-config.ts
const bootstrapConfig = {
  list: [
    '/dns4/am6.bootstrap.libp2p.io/tcp/443/wss/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    '/dns4/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
    '/dns4/sv15.bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    // va1 is not in the TXT records for _dnsaddr.bootstrap.libp2p.io yet
    // so use the host name directly
    '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
    '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ'
  ]
}

// Function to get the public IP address
async function getPublicIP (): Promise<string> {
  try {
    // Try to get public IP from a service
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch (err) {
    console.warn('[ipfs] Could not detect public IP, using 0.0.0.0')
    return '0.0.0.0'
  }
}

function getRandomPortInRange (min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
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
    this.options = { ...options, useWebRTC: options.useWebRTC ?? true }
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

    const tcpPort = await getPort({ port: 4001 })
    const wsPort = await getPort({ port: 4002 })
    let webrtcPort: number | null = null

    // Only initialize WebRTC port if useWebRTC is explicitly true
    if (this.options.useWebRTC === true) {
      const maxRetries = 10
      for (let i = 0; i < maxRetries; i++) {
        const candidatePort = getRandomPortInRange(50000, 60000)
        try {
          webrtcPort = await getPort({ port: candidatePort })
          console.log(`Selected WebRTC port: ${String(webrtcPort)}`)
          break
        } catch (err) {
          console.warn(`Port ${candidatePort} unavailable, retrying (${i + 1}/${maxRetries})...`)
          if (i === maxRetries - 1) {
            throw new Error(`Failed to find an available WebRTC port in range 50000-60000 after ${maxRetries} retries`)
          }
        }
      }

      if (webrtcPort === null) {
        throw new Error('Failed to assign WebRTC port')
      }
    }

    // Default libp2p config: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/libp2p-defaults.ts
    const defaults = await libp2pDefaults()

    // Get public IP for announce addresses
    const publicIP = await getPublicIP()
    console.log(`[ipfs] Using public IP for announce: ${publicIP}`)

    const libp2pOptions = {
      ...defaults,
      addresses: {
        listen: [
          `/ip4/0.0.0.0/tcp/${tcpPort}`,
          `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
          `/ip6/::/tcp/${tcpPort}`,
          `/ip6/::/tcp/${wsPort}/ws`,
          ...(this.options.useWebRTC === true
            ? [
              `/ip4/0.0.0.0/udp/${String(webrtcPort)}/webrtc-direct`,
              `/ip6/::/udp/${String(webrtcPort)}/webrtc-direct`
              ]
            : []),
          '/p2p-circuit'
        ],
        announce: [
          `/ip4/${publicIP}/tcp/${tcpPort}`,
          `/ip4/${publicIP}/tcp/${wsPort}/ws`
        ]
      },
      transports: [
        tcp(),
        webSockets(),
        ...(this.options.useWebRTC === true ? [webRTCDirect()] : [])
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [bootstrap(bootstrapConfig)],
      services: {
        ...defaults.services,
        autoNAT: autoNAT(),
        autoTLS: autoTLS(),
        dcutr: dcutr(),
        // delegatedRouting: () => createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev', delegatedHTTPRoutingDefaults()),
        dht: kadDHT({
          clientMode: false,
          allowQueryWithZeroPeers: true,
          validators: {
            ipns: ipnsValidator
          },
          selectors: {
            ipns: ipnsSelector
          },
          peerInfoMapper: removePrivateAddressesMapper,
          reprovide: { concurrency: 10 }
        }),
        identify: identify(),
        identifyPush: identifyPush(),
        keychain: keychain(),
        ping: ping(),
        upnpNAT: uPnPNAT()
      },
      connectionManager: {
        inboundConnectionThreshold: 100,
        maxIncomingPendingConnections: 100,
        maxConnections: 500
      }
    }

    this.helia = await createHelia({ datastore, blockstore, libp2p: libp2pOptions })
    this.ipfsFs = unixfs(this.helia)
    this.ipns = ipns(this.helia)
    console.timeEnd('Helia Initialization') // Log init time

    // Log the Helia node ID (Peer ID) after initialization
    const nodeId: string = this.helia.libp2p.peerId.toString()
    console.log(`[ipfs] Helia node initialized with ID: ${nodeId}`)

    this.onCleanup.push(async () => {
      await this.helia.stop()
    })
  }

  async unload (): Promise<void> {
    for (const onCleanup of this.onCleanup) {
      await onCleanup()
    }
  }

  async listDirectory (cid: CID, ctx?: Ctx): Promise<void> {
    const fs = this.ipfsFs
    if (fs == null) return

    try {
      ctx?.logger.info(`[ipfs] Listing directory contents for CID: ${cid.toString()}`)
      for await (const entry of fs.ls(cid)) {
        ctx?.logger.info(
          `[ipfs] Directory entry: ${String(entry.name)} => ${String(entry.cid)}`
        )
      }
    } catch (err) {
      ctx?.logger.error(`[ipfs] Error listing directory: ${err instanceof Error ? err.message : String(err)}`)
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
        ctx?.logger.info(`[ipfs] Read file ${String(file)} (${String(content.length)} bytes)`)
      } catch (err) {
        ctx?.logger.error(`[ipfs] Error reading file ${file}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const cid = await this.addDirectory(folderPath, ctx, ipfsFs)
    await this.listDirectory(cid, ctx)
    console.timeLog(timerLabel, 'Directory Added') // Log after directory
    ctx?.logger.info(`[ipfs] Added directory with CID ${cid.toString()} (type: ${typeof cid})`)

    const { publishKey, cid: publishedCid } = await this.publishSite(id, cid, ctx)
    console.timeLog(timerLabel, 'Site Published') // Log after publish
    ctx?.logger.info(`[ipfs] Published CID comparison - Original: ${cid.toString()}, Published: ${String(publishedCid)}`)
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
    ctx?.logger.info(`[ipfs] Adding directory recursively at path: ${folderPath}`)

    const fs = ipfsFs ?? this.ipfsFs
    if (fs == null) {
      throw createError(500, 'UnixFS instance not available')
    }

    try {
      // Read directory contents to log what's being added
      const files = await fsPromises.readdir(folderPath, { withFileTypes: true })
      ctx?.logger.info(`[ipfs] Found ${String(files.length)} entries in directory: ${files.map(f => `${f.name} (isFile: ${String(f.isFile())})`).join(', ')}`)

      if (files.length === 0) {
        ctx?.logger.warn(`[ipfs] No files found in directory: ${folderPath}`)
        return CID.parse('bafyaabakaieac') // Empty directory CID
      }

      // Use unixfs.addAll to recursively add the directory
      const readable = Readable.from(
        (async function * () {
          for (const file of files) {
            const fullPath = path.join(folderPath, file.name)
            if (file.isFile()) {
              const stat = await fsPromises.stat(fullPath)
              const content = createReadStream(fullPath)
              yield { path: file.name, content }
              ctx?.logger.info(`[ipfs] Queued file for addition: ${file.name} (${String(stat.size)} bytes)`)
            } else if (file.isDirectory()) {
              ctx?.logger.info(`[ipfs] Skipping subdirectory: ${file.name}`)
            }
          }
        })()
      )

      let dirCid: CID | null = null
      for await (const entry of fs.addAll(readable, { wrapWithDirectory: true, cidVersion: 1 })) {
        ctx?.logger.info(`[ipfs] Added entry: ${String(entry.path)} => ${String(entry.cid)}`)
        dirCid = entry.cid
      }

      if (dirCid == null) {
        throw new Error('Failed to generate directory CID')
      }

      ctx?.logger.info(`[ipfs] Final directory CID: ${dirCid.toString()}`)

      // Pin the directory
      await this.helia.pins.add(dirCid)
      ctx?.logger.info(`[ipfs] Pinned directory CID: ${dirCid.toString()}`)

      // Advertise the directory CID in the DHT with retries
      const maxProvideRetries = 3
      for (let attempt = 0; attempt < maxProvideRetries; attempt++) {
        try {
          await this.helia.libp2p.contentRouting.provide(dirCid)
          ctx?.logger.info(`[ipfs] Provided ${dirCid.toString()} to DHT (attempt ${attempt + 1})`)
          break // success
        } catch (err) {
          if (err instanceof Error && err.name === 'QueryAbortedError') {
            const delay = 2000 * (attempt + 1)
            ctx?.logger.warn(`[ipfs] DHT provide aborted (attempt ${attempt + 1}/${maxProvideRetries}), retrying in ${delay}ms`)
            if (attempt === maxProvideRetries - 1) {
              ctx?.logger.error(`[ipfs] DHT provide failed after ${maxProvideRetries} attempts: ${err.message}`)
            } else {
              // Wait before next retry
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          } else {
            ctx?.logger.error(`[ipfs] DHT provide operation failed: ${err instanceof Error ? err.message : String(err)}`)
            break
          }
        }
      }

      return dirCid
    } catch (err) {
      ctx?.logger.error(`[ipfs] Error adding directory: ${err instanceof Error ? err.message : String(err)}`)
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

    ctx?.logger.info(`[ipfs] Publishing CID ${cid.toString()} (type: ${typeof cid}, isValidCID: ${String(!(CID.asCID(cid) == null))}) to IPNS with key ${String(name)}`)
    await this.ipns.publish(privateKey, cid, { signal: AbortSignal.timeout(120000) })
    ctx?.logger.info('[ipfs] Successfully published to IPNS, verifying resolution...')

    // Verify the published value
    const peerId = await peerIdFromPrivateKey(privateKey)

    const peerIdCid = await peerId.toCID()
    const publishKey = peerIdCid.toString(base36)
    const ipnsPath = `/ipns/${publishKey}`

    try {
      const resolved = await this.ipns.resolve(ipnsPath)
      console.log(`IPNS resolved to: ${String(resolved?.cid)}`)

      // Add proper guards for the resolved value
      if (resolved == null) {
        ctx?.logger.warn(`[ipfs] [expected-delay] IPNS resolution returned null/undefined for key ${String(name)}`)
      } else {
        ctx?.logger.info(`[ipfs] IPNS resolution check - Published: ${cid.toString()}, Resolved: ${String(resolved.cid)}`)
      }
    } catch (err) {
      // More specific error handling for IPNS resolution failures
      if (err instanceof Error) {
        if (err.message.includes('IPNS record not found')) {
          ctx?.logger.warn(`[ipfs] [expected-delay] IPNS record not found yet for key ${String(name)} - this is normal immediately after publishing`)
        } else if (err.message.includes('Cannot read properties of undefined')) {
          ctx?.logger.warn(`[ipfs] [expected-delay] IPNS resolution returned undefined value for key ${String(name)} - this may be a temporary issue`)
        } else {
          ctx?.logger.error(`[ipfs] IPNS resolution check failed: ${err.message}`)
        }
      } else {
        ctx?.logger.error(`[ipfs] IPNS resolution check failed: ${String(err)}`)
      }
    }

    return { publishKey, cid: cid.toString() }
  }

  async unsync (id: string, _: Static<typeof IPFSProtocolFields>, ctx?: Ctx): Promise<void> {
    if (this.helia == null || this.ipns == null) {
      throw createError(500, 'Helia must be initialized')
    }
    const name = `dp-site-${id}`
    const privateKey = await this.loadKey(name)
    if (privateKey != null) {
      const EMPTY = CID.parse('bafyaabakaieac')
      await this.ipns.publish(privateKey, EMPTY, { signal: AbortSignal.timeout(120000) })
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

    try {
      // Use the public key directly instead of the IPNS name string
      const resolved = await this.ipns.resolve(privateKey.publicKey)

      // Add proper guards for the resolved value
      if (resolved == null) {
        console.warn(`[ipfs] [expected-delay] IPNS resolution returned null/undefined for key ${String(name)} in stats`)
        return { peerCount: 0 }
      }

      let count = 0
      for await (const provider of this.helia.libp2p.services.dht.findProviders(resolved.cid)) {
        void provider
        count++
      }
      return { peerCount: count }
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message.includes('IPNS record not found')) {
          return { peerCount: 0 }
        } else if (e.message.includes('Cannot read properties of undefined')) {
          console.warn(`[ipfs] [expected-delay] IPNS resolution returned undefined value for key ${String(name)} in stats`)
          return { peerCount: 0 }
        }
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
