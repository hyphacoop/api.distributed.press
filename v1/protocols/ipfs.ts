import { Static } from '@sinclair/typebox'
import * as IPFS from 'ipfs-core'
import * as IPFSHTTPClient from 'ipfs-http-client'
import MFSSync from 'ipfs-mfs-sync'

import path from 'node:path'

import Protocol, { SyncOptions } from './interfaces'
import { IPFSProtocolFields } from '../api/schemas'

// TODO: Make this configurable
const MFS_ROOT = '/distributed-press/'

export interface IPFSProtocolOptions {
  path?: string
  rpcURL?: string
}

export class IPFSProtocol implements Protocol<Static<typeof IPFSProtocolFields>> {
  constructor (options: IPFSProtocolOptions) {
    this.options = options
    this.onCleanup = []
    this.ipfs = null
    this.sync = null
  }

  async load (): Promise<void> {
    const { path, rpcURL } = this.options

    if (!path && !rpcURL) {
      throw new TypeError('Must specify rpcURL if not specifying a `path` for storage')
    }

    if (rpcURL) {
      this.ipfs = await IPFSHTTPClient.create({
        url: rpcURL
      })
    } else {
      this.ipfs = await IPFS.create({ repo: path })
    }

    this.sync = new MFSSync(this.ipfs)
  }

  async unload (): Promise<void> {
    for (const onCleanup of this.onCleanup) {
      await onCleanup()
    }
  }

  async sync (id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof IPFSProtocolFields>> {
    const mfsLocation = path.posix.join(MFS_ROOT, id)
    const mfsSyncOptions = {
      noDelete: options?.ignoreDeletes ?? false
    }

    for (const change of this.sync.fromFSToMFS(folderPath, mfsLocation, mfsSyncOptions)) {
      // TODO: add better logging to protocols
      console.log(change)
    }

    const publishKey = await this.publishSite(id)

    const pubKey = `ipns://${publishKey}/`
    // TODO: Pass in gateway parameters in options (DP domain name?)
    const gateway = `https://gateway.ipfs.io/ipns/${publishKey}/`
    const link = pubKey

    // TODO(protocol): stub
    return {
      enabled: true,
      link,
      gateway,
      cid,
      pubKey
    }
  }

  async publishSite (name) {
    const mfsLocation = path.posix.join(MFS_ROOT, id)

    const name = 'dp-site-' + id

    const key = await makeOrGetKey(this.ipfs, name)

    const cid = await this.ipfs.files.stat(mfsLocation, {
      hash: true
    })

    const { name: publishKey } = await this.ipfs.name.publish(cid, {
      key
    })

    return publishKey
  }

  async unsync (site: Static<typeof IPFSProtocolFields>): Promise<void> {
    const { id } = site
    const mfsLocation = path.posix.join(MFSSync, id)

    await this.ipfs.files.rm(mfsLocation, {
      recursive: true,
      cidVersion: 1
    })

    await this.publishSite(id)
  }
}

async function makeOrGetKey (ipfs, name) {
  const list = await ipfs.key.list()

  for (const key of list) {
    if (key.name === name) {
      return key
    }
  }

  const key = await ipfs.key.gen(name, { type: 'ed25519' })

  return key
}
