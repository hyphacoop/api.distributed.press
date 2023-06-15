import { IPFSProtocol, IPFSProtocolOptions } from './ipfs.js'
import { HyperProtocol, HyperProtocolOptions } from './hyper.js'
import { BitTorrentProtocol, BitTorrentProtocolOptions } from './bittorrent.js'
import { HTTPProtocol, HTTPProtocolOptions } from './http.js'
import Protocol from './interfaces.js'
import { Static } from '@sinclair/typebox'
import { HTTPProtocolFields, HyperProtocolFields, IPFSProtocolFields, BitTorrentProtocolFields } from '../api/schemas.js'

interface ProtocolOptions {
  ipfs: IPFSProtocolOptions
  hyper: HyperProtocolOptions
  bittorrent: BitTorrentProtocolOptions
  http: HTTPProtocolOptions
}

export interface ProtocolManager {
  http: Protocol<Static<typeof HTTPProtocolFields>>
  ipfs: Protocol<Static<typeof IPFSProtocolFields>>
  hyper: Protocol<Static<typeof HyperProtocolFields>>
  bittorrent: Protocol<Static<typeof BitTorrentProtocolFields>>
}

export class ConcreteProtocolManager implements ProtocolManager {
  http: HTTPProtocol
  ipfs: IPFSProtocol
  hyper: HyperProtocol
  bittorrent: BitTorrentProtocol

  constructor (options: ProtocolOptions) {
    this.http = new HTTPProtocol(options.http)
    this.ipfs = new IPFSProtocol(options.ipfs)
    this.hyper = new HyperProtocol(options.hyper)
    this.bittorrent = new BitTorrentProtocol(options.bittorrent)
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
