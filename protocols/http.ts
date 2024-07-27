import Protocol, { Ctx, SyncOptions } from './interfaces.js'
import { Static } from '@sinclair/typebox'
import { HTTPProtocolFields } from '../api/schemas.js'

export interface HTTPProtocolOptions {
  path: string
}

export class HTTPProtocol implements Protocol<Static<typeof HTTPProtocolFields>> {
  options: HTTPProtocolOptions
  constructor (options: HTTPProtocolOptions) {
    this.options = options
  }

  async load (): Promise<void> {
    // TODO(protocol): stub
    return await Promise.resolve()
  }

  async unload (): Promise<void> {
    // TODO(protocol): stub
    return await Promise.resolve()
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof HTTPProtocolFields>> {
    // TODO(protocol): stub
    return {
      enabled: true,
      link: 'example-link'
    }
  }

  async unsync (id: string, site: Static<typeof HTTPProtocolFields>, ctx?: Ctx): Promise<void> {
    return await Promise.resolve()
  }
}
