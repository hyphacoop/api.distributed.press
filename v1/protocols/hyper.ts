import * as SDK from 'hyper-sdk'
import LocalDrive from 'localdrive'

import { Static } from '@sinclair/typebox'

import Protocol, { SyncOptions } from './interfaces'
import { HyperProtocolFields } from '../api/schemas'

export interface HyperProtocolOptions {
  path: string
}

export class HyperProtocol implements Protocol<Static<typeof HyperProtocolFields>> {
  options: HyperProtocolOptions
  sdk: SDK | null
  drives: Map<string, any>

  constructor(options: HyperProtocolOptions) {
    this.options = options
    this.sdk = null
    this.drives = new Map()
  }

  async load(): Promise<void> {
    const { path: storage } = this.options
    // TODO: Where do we signal to load up all the initial sites?
    this.sdk = await SDK.create({ storage })
  }

  async getDrive(id: string) {
    if (this.drives.has(id)) {
      return this.drives.get(id)
    }
    const drive = await this.sdk.getDrive(id)
    this.drives.set(id, drive)

    drive.once('close', () => {
      this.drives.delete(id)
    })

    return drive
  }

  async sync(id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof HyperProtocolFields>> {
    const drive = await this.getDrive(id)
    const fs = new LocalDrive(folderPath)

    const mirror = fs.mirror(drive)

    // TODO: Should we log the changes somewhere like IPFS?
    await mirror.done()

    const raw = drive.url
    const link = raw
    // TODO: Pass in the gateway URL in the config first
    const gateway = 'oops'

    return {
      enabled: true,
      link,
      gateway,
      raw
    }
  }

  async unsync(id: string, _site: Static<typeof HyperProtocolFields>): Promise<void> {
    const drive = await this.getDrive(id)
    // TODO: Should we also clear the stored data?
    await drive.close()
  }
}
