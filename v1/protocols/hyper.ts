import * as SDK from 'hyper-sdk'
import LocalDrive from 'localdrive'
import { Static } from '@sinclair/typebox'
import Protocol, { Ctx, SyncOptions } from './interfaces'
import { HyperProtocolFields } from '../api/schemas'

export interface HyperProtocolOptions {
  path: string
}

export class HyperProtocol implements Protocol<Static<typeof HyperProtocolFields>> {
  options: HyperProtocolOptions
  sdk: SDK.SDK | null
  drives: Map<string, any>

  constructor (options: HyperProtocolOptions) {
    this.options = options
    this.sdk = null
    this.drives = new Map<string, SDK.Hyperdrive>()
  }

  async load (): Promise<void> {
    const { path } = this.options
    this.sdk = await SDK.create({ storage: path })
  }

  async unload (): Promise<void> {
    return await this.sdk?.close()
  }

  async getDrive (id: string): Promise<SDK.Hyperdrive> {
    if (this.drives.has(id)) {
      return this.drives.get(id)
    }

    if (this.sdk === null) {
      throw new Error('Hypercore SDK called before being initialized')
    }

    const drive = await this.sdk.getDrive(id)
    this.drives.set(id, drive)
    drive.once('close', () => {
      this.drives.delete(id)
    })

    return drive
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof HyperProtocolFields>> {
    ctx?.logger.info('[hyper] Sync Start')
    const drive = await this.getDrive(id)
    const fs = new LocalDrive(folderPath)

    const mirror = fs.mirror(drive)

    // TODO: Should we log the changes somewhere like IPFS?
    for await (const change of mirror) {
      ctx?.logger.debug(`[hyper] ${change.op}: ${change.key}`)
    }

    const raw = drive.url
    const link = raw
    // TODO: Pass in gateway from config
    const gateway = `https://hyper.hypha.coop/hyper/${drive.id}/`

    ctx?.logger.info(`[hyper] Published: ${link}`)

    return {
      enabled: true,
      link,
      gateway,
      raw
    }
  }

  async unsync (id: string, _site: Static<typeof HyperProtocolFields>, ctx?: Ctx): Promise<void> {
    const drive = await this.getDrive(id)

    // TODO: Should we also clear the stored data?
    await drive.close()
  }
}
