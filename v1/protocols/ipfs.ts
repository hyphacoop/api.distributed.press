import Protocol, { SyncOptions } from './interfaces'
import { Static } from '@sinclair/typebox'
import { IPFSProtocolFields } from '../api/schemas'

export class IPFSProtocol implements Protocol<Static<typeof IPFSProtocolFields>> {
  async load (): Promise<void> {
    // TODO(protocol): stub
    return Promise.resolve()
  }

  async sync (id: string, folderPath: string, options?: SyncOptions): Promise<Static<typeof IPFSProtocolFields>> {
    // TODO(protocol): stub
    return {
      enabled: true,
      link: "example-link",
      gateway: "example-gateway",
      cid: "example-cid",
      pubKey: "example-pubkey"
    }
  }

  async unsync (site: Static<typeof IPFSProtocolFields>): Promise<void> {
    return Promise.resolve()
  }
}
