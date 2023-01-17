import Protocol, { SyncOptions } from './interfaces'
import { Static } from '@sinclair/typebox'
import { HTTPProtocolFields } from '../api/schemas'

export class HTTPProtocol implements Protocol<Static<typeof HTTPProtocolFields>> {
  async load (): Promise<void> {
    // TODO(protocol): stub
    return await Promise.resolve()
  }

  async sync (id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof HTTPProtocolFields>> {
    // TODO(protocol): stub
    return {
      enabled: true,
      link: 'example-link'
    }
  }

  async unsync (site: Static<typeof HTTPProtocolFields>): Promise<void> {
    return await Promise.resolve()
  }
}
