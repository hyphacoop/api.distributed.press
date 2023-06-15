import { Static, TSchema } from '@sinclair/typebox'
import { HTTPProtocolFields, HyperProtocolFields, IPFSProtocolFields, BitTorrentProtocolFields } from '../api/schemas.js'
import { ProtocolManager } from '../protocols/index.js'
import Protocol, { Ctx, SyncOptions } from '../protocols/interfaces.js'

export class MockProtocolManager implements ProtocolManager {
  http: MockHTTPProtocol
  ipfs: MockIPFSProtocol
  hyper: MockHyperProtocol
  bittorrent: MockBitTorrentProtocol

  constructor () {
    this.ipfs = new MockIPFSProtocol()
    this.http = new MockHTTPProtocol()
    this.hyper = new MockHyperProtocol()
    this.bittorrent = new MockBitTorrentProtocol()
  }

  async load (): Promise<void> {
    const promises = [
      this.ipfs.load(),
      this.hyper.load(),
      this.bittorrent.load(),
      this.http.load()
    ]
    await Promise.all(promises)
  }

  async unload (): Promise<void> {
    const promises = [
      this.ipfs.unload(),
      this.hyper.unload(),
      this.bittorrent.unload(),
      this.http.unload()
    ]
    await Promise.all(promises)
  }
}

abstract class BaseMockProtocol<T extends TSchema> implements Protocol<Static<T>> {
  async load (): Promise<void> {
    return await Promise.resolve()
  }

  async unload (): Promise<void> {
    return await Promise.resolve()
  }

  abstract sync (_id: string, _folderPath: string, _options?: SyncOptions, _ctx?: Ctx): Promise<Static<T>>
  async unsync (_id: string, _site: Static<typeof HTTPProtocolFields>, _ctx?: Ctx): Promise<void> {
    return await Promise.resolve()
  }
}

class MockHTTPProtocol extends BaseMockProtocol<typeof HTTPProtocolFields> {
  async sync (_id: string, _folderPath: string, _options?: SyncOptions, _ctx?: Ctx): Promise<Static<typeof HTTPProtocolFields>> {
    return {
      enabled: true,
      link: 'https://example-link'
    }
  }
}

class MockIPFSProtocol extends BaseMockProtocol<typeof IPFSProtocolFields> {
  async sync (_id: string, _folderPath: string, _options?: SyncOptions, _ctx?: Ctx): Promise<Static<typeof IPFSProtocolFields>> {
    return {
      enabled: true,
      link: 'ipns://example-link',
      gateway: 'https://example-ipfs-gateway/example-link',
      cid: 'example-cid',
      pubKey: 'ipns://example-pubkey',
      dnslink: '/ipns/example-pubkey'
    }
  }
}

class MockHyperProtocol extends BaseMockProtocol<typeof HyperProtocolFields> {
  async sync (_id: string, _folderPath: string, _options?: SyncOptions, _ctx?: Ctx): Promise<Static<typeof HyperProtocolFields>> {
    return {
      enabled: true,
      link: 'hyper://example-link',
      gateway: 'https://example-hyper-gateway/example-link',
      raw: 'example-raw',
      dnslink: '/hyper/example-raw'
    }
  }
}

class MockBitTorrentProtocol extends BaseMockProtocol<typeof BitTorrentProtocolFields> {
  async sync (_id: string, _folderPath: string, _options?: SyncOptions, _ctx?: Ctx): Promise<Static<typeof BitTorrentProtocolFields>> {
    return {
      enabled: true,
      link: 'bittorrent://example-link',
      gateway: 'https://example-bittorrent-gateway/example-link',
      dnslink: '/bt/example-raw',
      infoHash: 'bittorrent://example-link-infohash',
      pubKey: 'bittorrent://example-link-publickey',
      magnet: 'magnet:?xt:urn:btih:example-link&xs=urn:btpk:example-link'
    }
  }
}
