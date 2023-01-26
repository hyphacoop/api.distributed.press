import { Static } from '@sinclair/typebox'

import * as IPFS from 'ipfs-core'
import * as IPFSHTTPClient from 'ipfs-http-client'
import * as GoIPFS from 'go-ipfs'
import Ctl from 'ipfsd-ctl'
import { Key } from 'ipfs-core-types/src/key/index.js'
import MFSSync from 'ipfs-mfs-sync'

import path from 'node:path'

import Protocol, { SyncOptions } from './interfaces.js'
import { IPFSProtocolFields } from '../api/schemas.js'

// TODO: Make this configurable
const MFS_ROOT = '/distributed-press/'

export const JsIpfs = 'js-ipfs' as const
export const Kubo = 'kubo' as const
export const Builtin = 'builtin' as const
export type IPFSProvider = typeof JsIpfs | typeof Kubo | typeof Builtin

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
      if (this.options.provider === Builtin) {
        const ipfsBin = GoIPFS.path()

        const ipfsOptions = {
          repo: this.options.path
        }

        const ipfsdOpts = {
          type: 'go',
          disposable: false,
          test: false,
          remote: false,
          ipfsOptions,
          ipfsHttpModule: IPFSHTTPClient,
          ipfsBin
        }
        const ipfsd = await Ctl.createController(ipfsdOpts)

        await ipfsd.init({ ipfsOptions })

        await ipfsd.start()
        await ipfsd.api.id()
        this.ipfs = ipfsd.api
        this.onCleanup.push(async () => {
          await ipfsd.stop()
        })
      } else if (this.options.provider === Kubo) {
      // rpcURL is for connecting to a Kubo Go-IPFS node
        this.ipfs = IPFSHTTPClient.create({
          url: this.options.path
        })
      } else {
      // path for initializing a js-ipfs instance
        this.ipfs = await IPFS.create({
          repo: this.options.path,
          EXPERIMENTAL: {
            ipnsPubsub: true
          },
          config: {
            Routing: {
              Type: 'dht'
            }
          }
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

  async sync (id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof IPFSProtocolFields>> {
    const mfsLocation = path.posix.join(this.mfsRoot, id)
    const mfsSyncOptions = {
      noDelete: options?.ignoreDeletes ?? false
    }

    if (this.mfsSync === null || this.ipfs === null) {
      return await Promise.reject(new Error('MFS must be initialized using load() before calling sync()'))
    }

    await this.ipfs.files.mkdir(mfsLocation, {
      parents: true,
      flush: true,
      cidVersion: 1
    })

    for await (const change of this.mfsSync.fromFSToMFS(folderPath, mfsLocation, mfsSyncOptions)) {
      // TODO: add better logging to protocols
      console.log(change)
    }

    const { publishKey, cid } = await this.publishSite(id)

    const pubKey = `ipns://${publishKey}/`
    // TODO: Pass in gateway parameters in options (DP domain name?)
    const gateway = `https://gateway.ipfs.io/ipns/${publishKey}/`
    const link = pubKey

    return {
      enabled: true,
      link,
      gateway,
      cid,
      pubKey
    }
  }

  async publishSite (id: string): Promise<PublishResult> {
    if (this.ipfs === null) {
      return await Promise.reject(new Error('IPFS must be initialized using load() before calling sync()'))
    }

    const mfsLocation = path.posix.join(this.mfsRoot, id)
    const name = `dp-site-${id}`
    const key = await makeOrGetKey(this.ipfs, name)
    console.log('Generated key', key)
    const statResult = await this.ipfs.files.stat(mfsLocation, {
      hash: true
    })

    const cid = statResult.cid
    console.log('Got root CID', cid)

    console.log('Performing IPNS publish')

    const publishResult = await this.ipfs.name.publish(cid, {
      key: key.name
    })

    console.log('Published!', publishResult)

    return {
      publishKey: publishResult.name,
      cid: cid.toString()
    }
  }

  async unsync (id: string, _site: Static<typeof IPFSProtocolFields>): Promise<void> {
    if (this.ipfs === null) {
      return await Promise.reject(new Error('IPFS must be initialized using load() before calling sync()'))
    }

    const mfsLocation = path.posix.join(this.mfsRoot, id)

    await this.ipfs.files.rm(mfsLocation, {
      recursive: true,
      cidVersion: 1
    })

    await this.publishSite(id)
  }
}

async function makeOrGetKey (ipfs: IPFS.IPFS, name: string): Promise<Key> {
  const list = await ipfs.key.list()

  for (const key of list) {
    if (key.name === name) {
      return key
    }
  }

  const key = await ipfs.key.gen(name, { type: 'Ed25519' })
  return key
}
