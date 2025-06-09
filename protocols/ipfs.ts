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
import { setMaxListeners } from 'events'

// Fix abort-signal leak crash loop
setMaxListeners(0)

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

// Function to get the public IP address
async function getPublicIP(): Promise<string> {
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
  peerMonitorInterval: NodeJS.Timeout | null

  constructor (options: IPFSProtocolOptions) {
    this.options = { ...options, useWebRTC: options.useWebRTC ?? true }
    this.onCleanup = []
    this.helia = null
    this.ipfsFs = null
    this.ipns = null
    this.peerMonitorInterval = null
  }

  async load (): Promise<void> {
    console.time('Helia Initialization') // Start timing
    const datastorePath = path.join(this.options.path, 'datastore')
    const blockstorePath = path.join(this.options.path, 'blockstore')
    const datastore = new FsDatastore(datastorePath)
    const blockstore = new FsBlockstore(blockstorePath)

    const tcpPort = await getPort({ port: 7976 })
    const wsPort = await getPort({ port: 7977 })
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

    // Get public IP for announce addresses
    const publicIP = await getPublicIP()
    console.log(`[ipfs] Using public IP for announce: ${publicIP}`)

    // Default libp2p config: https://github.com/ipfs/helia/blob/main/packages/helia/src/utils/libp2p-defaults.ts
    const defaults = await libp2pDefaults()
    
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
          // Add public addresses that external peers can reach
          `/ip4/${publicIP}/tcp/${tcpPort}`,
          `/ip4/${publicIP}/tcp/${wsPort}/ws`,
          ...(this.options.useWebRTC === true
            ? [`/ip4/${publicIP}/udp/${String(webrtcPort)}/webrtc-direct`]
            : [])
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
          clientMode: false,
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
    
    // Start the libp2p node
    await this.helia.libp2p.start()
    
    // Log multiaddrs
    for (const addr of this.helia.libp2p.getMultiaddrs()) {
      console.log('[ipfs] announcing as:', addr.toString())
    }
    
    this.ipfsFs = unixfs(this.helia)
    this.ipns = ipns(this.helia)
    console.timeEnd('Helia Initialization') // Log init time

    // Log the Helia node ID (Peer ID) after initialization
    const nodeId: string = this.helia.libp2p.peerId.toString()
    console.log(`[ipfs] Helia node initialized with ID: ${nodeId}`)

    // Start peer monitoring for debugging
    this.startPeerMonitoring()

    this.onCleanup.push(async () => {
      this.stopPeerMonitoring()
      await this.helia.stop()
    })
  }

  startPeerMonitoring(): void {
    this.peerMonitorInterval = setInterval(() => {
      if (this.helia?.libp2p) {
        const peerCount = this.helia.libp2p.getPeers().length
        console.log(`[ipfs] Connected peers: ${peerCount}`)
        
        // Log some peer addresses for debugging
        const peers = this.helia.libp2p.getPeers().slice(0, 3)
        if (peers.length > 0) {
          peers.forEach((peer: any) => {
            console.log(`[ipfs] Peer: ${peer.toString()}`)
          })
        }
      }
    }, 30000) // Every 30 seconds
  }

  stopPeerMonitoring(): void {
    if (this.peerMonitorInterval) {
      clearInterval(this.peerMonitorInterval)
      this.peerMonitorInterval = null
    }
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

    // Verify content is accessible before publishing
    const isContentAccessible = await this.verifyContent(cid, ctx)
    if (!isContentAccessible) {
      ctx?.logger.warn('[ipfs] Content verification failed before publishing, but continuing...')
    }

    const { publishKey, cid: publishedCid } = await this.publishSite(id, cid, ctx)
    console.timeLog(timerLabel, 'Site Published') // Log after publish
    ctx?.logger.info(`[ipfs] Published CID comparison - Original: ${cid.toString()}, Published: ${String(publishedCid)}`)
    const subdomain = id.replace(/-/g, '--').replace(/\./g, '-')

    // Test if the CID is accessible from external sources
    await this.testCIDAccessibility(publishedCid, ctx)

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

      // Provide to DHT with timeout to prevent hanging
      try {
        const providePromise = this.helia.libp2p.services.dht.provide(dirCid)
        await Promise.race([
          providePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DHT provide timeout')), 30000)
          )
        ])
        ctx?.logger.info(`[ipfs] Provided directory CID to DHT: ${dirCid.toString()}`)
      } catch (err) {
        ctx?.logger.warn(`[ipfs] DHT provide failed or timed out: ${err instanceof Error ? err.message : String(err)}`)
        // Continue anyway - the content is still accessible via your node
      }

      // Verify the provide operation by checking if we can find ourselves as a provider
      try {
        const providers = []
        for await (const provider of this.helia.libp2p.services.dht.findProviders(dirCid, { timeout: 10000 })) {
          // Add null safety check here
          if (provider?.id) {
            providers.push(provider.id.toString())
          }
        }
        const ourPeerId = this.helia.libp2p.peerId.toString()
        if (providers.includes(ourPeerId)) {
          ctx?.logger.info(`[ipfs] ✅ DHT provide verification successful - our peer found as provider`)
        } else {
          ctx?.logger.warn(`[ipfs] ⚠️ DHT provide verification failed - our peer not found as provider. Found: ${providers.join(', ')}`)
        }
      } catch (err) {
        ctx?.logger.warn(`[ipfs] DHT provide verification failed: ${err instanceof Error ? err.message : String(err)}`)
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
    
    // Create proper AbortController with cleanup to prevent listener leaks
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000) // Reduced from 60s to 15s
    
    try {
      await this.ipns.publish(privateKey, cid, { signal: ctrl.signal })
      ctx?.logger.info('[ipfs] Successfully published to IPNS, verifying resolution...')
    } finally {
      clearTimeout(timer)
    }

    // Verify the published value
    const peerId = await peerIdFromPrivateKey(privateKey)
    try {
      // Use the public key directly instead of the IPNS name string
      const resolved = await this.ipns.resolve(privateKey.publicKey)
      
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
      
      // Create proper AbortController with cleanup to prevent listener leaks
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 5000)
      
      try {
        await this.ipns.publish(privateKey, EMPTY, { signal: ctrl.signal })
        ctx?.logger.info(`[ipfs] Unsynced ${id}`)
      } finally {
        clearTimeout(timer)
      }
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

  // Test if a CID is accessible from external sources
  async testCIDAccessibility (cid: string, ctx?: Ctx): Promise<void> {
    const gateways = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`
    ]

    ctx?.logger.info(`[ipfs] Testing CID accessibility for: ${cid}`)
    
    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(10000)
        })
        if (response.ok) {
          ctx?.logger.info(`[ipfs] ✅ CID accessible via ${gateway}`)
        } else {
          ctx?.logger.warn(`[ipfs] ⚠️ CID not accessible via ${gateway} (${response.status})`)
        }
      } catch (err) {
        ctx?.logger.warn(`[ipfs] ❌ CID not accessible via ${gateway}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Add content verification method
  async verifyContent(cid: CID, ctx?: Ctx): Promise<boolean> {
    try {
      // Try to list the directory to verify it's accessible
      const entries = []
      for await (const entry of this.ipfsFs.ls(cid)) {
        entries.push(entry.name)
      }
      ctx?.logger.info(`[ipfs] Content verification successful. Files: ${entries.join(', ')}`)
      return true
    } catch (err) {
      ctx?.logger.error(`[ipfs] Content verification failed: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }
}
