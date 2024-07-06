import { Static } from '@sinclair/typebox'
import * as IPFSHTTPClient from 'ipfs-http-client'
import * as GoIPFS from 'go-ipfs'
import { ControllerOptions, Controller, createController } from 'ipfsd-ctl'
import path from 'node:path'
import Protocol, { Ctx, SyncOptions } from './interfaces.js'
import { IPFSProtocolFields } from '../api/schemas.js'
import getPort from 'get-port'
import { rm } from 'node:fs/promises'
import { globSource } from 'ipfs-http-client'
import { IPFS } from 'ipfs-core-types'
import createError from 'http-errors'

// TODO: Make this configurable
const MFS_ROOT = '/distributed-press/'

// TODO(docs): clarify what these actually do
export const KUBO = 'kubo' as const
export const BUILTIN = 'builtin' as const
export type IPFSProvider = typeof KUBO | typeof BUILTIN

export interface IPFSProtocolOptions {
  path: string
  provider: IPFSProvider
  ipfs?: IPFS
  mfsRoot?: string
}

export interface PublishResult {
  cid: string
  publishKey: string
}

export type CleanupCallback = () => Promise<void>

export class IPFSProtocol implements Protocol<Static<typeof IPFSProtocolFields>> {
  options: IPFSProtocolOptions
  onCleanup: CleanupCallback[]
  ipfs: IPFS | null
  mfsRoot: string

  constructor (options: IPFSProtocolOptions) {
    this.options = options
    this.onCleanup = []
    this.ipfs = options.ipfs ?? null
    this.mfsRoot = options.mfsRoot ?? MFS_ROOT
  }

  async load (): Promise<void> {
    if (this.ipfs === null) {
      if (this.options.provider === BUILTIN) {
        // 4737 == IPFS on a dialpad
        const apiPort = await getPort({ port: 4737 })
        // 7976 is SWRM on a dialpad
        const swarmPort = await getPort({ port: 7976 })

        const ipfsOptions = {
          repo: this.options.path,
          config: {
            Experimental: {
              AcceleratedDHTClient: true
            },
            Gateway: null,
            Addresses: {
              API: `/ip4/127.0.0.1/tcp/${apiPort}`,
              Gateway: null,
              Swarm: [
                  `/ip4/0.0.0.0/tcp/${swarmPort}`,
                  `/ip6/::/tcp/${swarmPort}`,
                  `/ip4/0.0.0.0/udp/${swarmPort}/quic`,
                  `/ip6/::/udp/${swarmPort}/quic`
              ]
            },
            Ipns: {
              UsePubSub: true
            },
            PubSub: {
              Enabled: true
            },
            Swarm: {
              ConnMgr: {
                HighWater: 512
              }
            }
          }
        }
        const ipfsdOpts: ControllerOptions = {
          type: 'go',
          ipfsOptions,
          ipfsHttpModule: IPFSHTTPClient,
          ipfsBin: GoIPFS.path()
        }

        let ipfsd: Controller | null = null

        try {
          ipfsd = await createController(ipfsdOpts)
          await ipfsd.init()
          await ipfsd.start()
          await ipfsd.api.id()
        } catch (cause) {
          const { repo } = ipfsOptions
          const lockFile = path.join(repo, 'repo.lock')
          const apiFile = path.join(repo, 'api')
          try {
            await Promise.all([
              rm(lockFile),
              rm(apiFile)
            ])
            ipfsd = await createController(ipfsdOpts)
            await ipfsd.start()
            await ipfsd.api.id()
          } catch (cause) {
            const message = 'Unable to start IPFS daemon'
            throw createError(500, message, { cause })
          }
        }

        let gracefulStop = false

        // When launching kubo, account for early exits
        if (ipfsd.subprocess != null) {
          void ipfsd.subprocess.once('exit', () => {
            if (!gracefulStop) {
              this.load().catch((e) => {
                console.error('Unable to restart kubo after it died.')
                console.error(e.stack)
                process.exit(1)
              })
            }
          })
        }

        this.ipfs = ipfsd.api
        this.onCleanup.push(async () => {
          gracefulStop = true
          if (ipfsd !== null) {
            await ipfsd.stop()
          }
        })
      } else if (this.options.provider === KUBO) {
        // rpcURL is for connecting to a Kubo Go-IPFS node
        this.ipfs = IPFSHTTPClient.create({
          url: this.options.path
        })
      }
    }
  }

  async unload (): Promise<void> {
    for (const onCleanup of this.onCleanup) {
      await onCleanup()
    }
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof IPFSProtocolFields>> {
    ctx?.logger.info('[ipfs] Sync Start')
    const mfsLocation = path.posix.join(this.mfsRoot, id)
    if (this.ipfs === null) {
      throw createError(500, 'IPFS must be initialized using load() before calling sync()')
    }

    // By default, inline empty directory CID
    let toPublish = '/ipfs/bafyaabakaieac/'
    let lastEntry = null

    const glob = globSource(folderPath, '**/*')
    const files = this.ipfs.addAll(glob, {
      pin: false,
      wrapWithDirectory: true,
      cidVersion: 1
    })

    for await (const file of files) {
      ctx?.logger.debug(`[ipfs] added ${file.path}`)
      lastEntry = file
    }

    if (lastEntry !== null) {
      toPublish = `/ipfs/${lastEntry.cid.toString()}/`
    }

    try {
      await this.ipfs.files.rm(mfsLocation, {
        recursive: true
      })
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes('file does not exist')) {
        throw e
      }
    }

    await this.ipfs.files.cp(toPublish, mfsLocation, {
      cidVersion: 1,
      parents: true,
      flush: true
    })

    // Publish site and return meta
    const { publishKey, cid } = await this.publishSite(id, ctx)
    const pubKey = `ipns://${publishKey}/`
    const subdomain = id.replaceAll('-', '--').replaceAll('.', '-')
    return {
      enabled: true,
      link: `ipns://${id}/`,
      // TODO: Pass in gateway parameters in options (DP domain name?)
      // TODO: Add "raw" gateway URLs
      gateway: `https://${subdomain}.ipns.ipfs.hypha.coop`,
      cid,
      pubKey,
      dnslink: `/ipns/${publishKey}/`
    }
  }

  private async publishSite (id: string, ctx?: Ctx): Promise<PublishResult> {
    if (this.ipfs === null) {
      throw createError(500, 'IPFS must be initialized using load() before calling sync()')
    }

    ctx?.logger.info('[ipfs] Sync start')
    const mfsLocation = path.posix.join(this.mfsRoot, id)
    const name = `dp-site-${id}`
    const key = await makeOrGetKey(this.ipfs, name)

    ctx?.logger.info(`[ipfs] Generated key: ${key.id}`)
    const statResult = await this.ipfs.files.stat(mfsLocation, {
      hash: true
    })

    const cid = statResult.cid
    ctx?.logger.info(`[ipfs] Got root CID: ${cid.toString()}, performing IPNS publish (this may take a while)...`)
    const publishResult = await this.ipfs.name.publish(cid, {
      key: key.name
    })

    ctx?.logger.info(`[ipfs] Published to IPFS under ${publishResult.name}: ${publishResult.value}`)

    return {
      publishKey: publishResult.name,
      cid: cid.toString()
    }
  }

  async unsync (id: string, _site: Static<typeof IPFSProtocolFields>, ctx?: Ctx): Promise<void> {
    if (this.ipfs === null) {
      throw createError(500, 'IPFS must be initialized using load() before calling sync()')
    }

    const mfsLocation = path.posix.join(this.mfsRoot, id)

    await this.ipfs.files.rm(mfsLocation, {
      recursive: true,
      cidVersion: 1
    })

    await this.publishSite(id, ctx)
  }
}

interface Key {
  id: string
  name: string
}
async function makeOrGetKey (ipfs: IPFS, name: string): Promise<Key> {
  const list = await ipfs.key.list()

  for (const key of list) {
    if (key.name === name) {
      return key
    }
  }

  // js-ipfs uses uppercase, but kubo expects lowercase
  return await ipfs.key.gen(name, { type: 'ed25519' as 'Ed25519' })
}
