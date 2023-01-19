import Protocol, { SyncOptions } from './interfaces'
import { Static } from '@sinclair/typebox'
import { HyperProtocolFields } from '../api/schemas'

export interface HyperProtocolOptions {
  path?: string
}

export class HyperProtocol implements Protocol<Static<typeof HyperProtocolFields>> {
  async load (): Promise<void> {
    // TODO(protocol): stub
    return await Promise.resolve()
  }

  async sync (id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof HyperProtocolFields>> {
    // TODO(protocol): stub
    return {
      enabled: true,
      link: 'example-link',
      gateway: 'example-gateway',
      raw: 'example-raw'
    }
  }

  async unsync (site: Static<typeof HyperProtocolFields>): Promise<void> {
    return await Promise.resolve()
  }
}
