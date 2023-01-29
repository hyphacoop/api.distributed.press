import { Static } from '@sinclair/typebox'
import * as IPFS from 'ipfs-core'
import * as IPFSHTTPClient from 'ipfs-http-client'
import * as GoIPFS from 'go-ipfs'
import { ControllerType, createController } from 'ipfsd-ctl'
import { Key } from 'ipfs-core-types/src/key/index.js'
import MFSSync from 'ipfs-mfs-sync'
import path from 'node:path'
import fs from 'node:fs/promises'
import Protocol, { Ctx, SyncOptions } from './interfaces.js'
import { IPFSProtocolFields } from '../api/schemas.js'

// TODO: Make this configurable
const MFS_ROOT = '/distributed-press/'

// TODO(docs): clarify what these actually do
export const JSIPFS = 'js-ipfs' as const
export const KUBO = 'kubo' as const
export const BUILTIN = 'builtin' as const
export type IPFSProvider = typeof JSIPFS | typeof KUBO | typeof BUILTIN

export interface IPFSProtocolOptions {
  path: string
  provider: IPFSProvider
  ipfs?: IPFS.IPFS
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
  ipfs: IPFS.IPFS | null
  mfsRoot: string
  mfsSync: MFSSync | null

  constructor (options: IPFSProtocolOptions) {
    this.options = options
    this.onCleanup = []
    this.ipfs = options.ipfs ?? null
    this.mfsRoot = options.mfsRoot ?? MFS_ROOT
    this.mfsSync = null
  }

  async load (): Promise<void> {
    if (this.ipfs === null) {
      if (this.options.provider === BUILTIN) {
        const ipfsdOpts = {
          type: 'go' as ControllerType,
          disposable: false,
          test: false,
          remote: false,
          ipfsOptions: {
            repo: this.options.path
          },
          ipfsHttpModule: IPFSHTTPClient,
          ipfsBin: GoIPFS.path()
        }

        // TODO(@jackyzha0): refactor this with backoff/retry
        // ask @rangermauve why this exists
        let ipfsd = await createController(ipfsdOpts)
        await ipfsd.init()

        try {
          await ipfsd.start()
          await ipfsd.api.id()
        } catch (e) {
          console.log(e)
          const lockFile = path.join(this.options.path, 'repo.lock')
          const apiFile = path.join(this.options.path, 'api')
          try {
            await Promise.all([
              fs.rm(lockFile),
              fs.rm(apiFile)
            ])
            ipfsd = await createController(ipfsdOpts)
            await ipfsd.start()
            await ipfsd.api.id()
          } catch (cause) {
            const message = `Unable to start daemon due to extra lockfile. Please clear your ipfs folder at ${this.options.path} and try again.`
            throw new Error(message, { cause })
          }
        }

        this.ipfs = ipfsd.api
        this.onCleanup.push(async () => {
          await ipfsd.stop()
        })
      } else if (this.options.provider === KUBO) {
        // rpcURL is for connecting to a Kubo Go-IPFS node
        this.ipfs = IPFSHTTPClient.create({
          url: this.options.path
        })
      } else {
        // path for initializing a js-ipfs instance
        this.ipfs = await IPFS.create({
          repo: this.options.path
          /* EXPERIMENTAL: {
            ipnsPubsub: true
          },
          config: {
            Routing: {
              Type: 'dht'
            }
          } */
        })
      }
    }

    this.mfsSync = new MFSSync(this.ipfs)
  }

  async unload (): Promise<void> {
    for (const onCleanup of this.onCleanup) {
      await onCleanup()
    }
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof IPFSProtocolFields>> {
    const mfsLocation = path.posix.join(this.mfsRoot, id)
    const mfsSyncOptions = {
      noDelete: options?.ignoreDeletes ?? false
    }
    if (this.mfsSync === null || this.ipfs === null) {
      return await Promise.reject(new Error('MFS must be initialized using load() before calling sync()'))
    }

    // Make a folder in MFS
    await this.ipfs.files.mkdir(mfsLocation, {
      parents: true,
      flush: true,
      cidVersion: 1
    })

    // Sync local disk files to MFS
    for await (const change of this.mfsSync.fromFSToMFS(folderPath, mfsLocation, mfsSyncOptions)) {
      ctx?.logger.debug(change)
    }

    // Publish site and return meta
    const { publishKey, cid } = await this.publishSite(id, ctx)
    const pubKey = `ipns://${publishKey}/`
    return {
      enabled: true,
      link: pubKey,
      // TODO: Pass in gateway parameters in options (DP domain name?)
      gateway: `https://gateway.ipfs.io/ipns/${publishKey}/`,
      cid,
      pubKey
    }
  }

  async publishSite (id: string, ctx?: Ctx): Promise<PublishResult> {
    if (this.ipfs === null) {
      return await Promise.reject(new Error('IPFS must be initialized using load() before calling sync()'))
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
    ctx?.logger.info(`[ipfs] Got root CID: ${cid.toString()}, performing IPNS publish...`)
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
      return await Promise.reject(new Error('IPFS must be initialized using load() before calling sync()'))
    }

    const mfsLocation = path.posix.join(this.mfsRoot, id)

    await this.ipfs.files.rm(mfsLocation, {
      recursive: true,
      cidVersion: 1
    })

    await this.publishSite(id, ctx)
  }
}

async function makeOrGetKey (ipfs: IPFS.IPFS, name: string): Promise<Key> {
  const list = await ipfs.key.list()

  for (const key of list) {
    if (key.name === name) {
      return key
    }
  }

  // js-ipfs uses uppercase, but kubo expects lowercase
  // @ts-expect-error
  return await ipfs.key.gen(name, { type: 'ed25519' })
}
