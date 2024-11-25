import Protocol, { Ctx, SyncOptions, ProtocolStats } from './interfaces'
import { Static } from '@sinclair/typebox'
import { HTTPProtocolFields } from '../api/schemas'

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
    // Generate the actual HTTP link based on the site ID (domain)
    const httpLink = `https://${id}`

    // Return the dynamically generated HTTP link
    return {
      enabled: true,
      link: httpLink
    }
  }

  async unsync (id: string, site: Static<typeof HTTPProtocolFields>, ctx?: Ctx): Promise<void> {
    return await Promise.resolve()
  }

  async stats (id: string): Promise<ProtocolStats> {
    return { peerCount: 0 }
  }
}
