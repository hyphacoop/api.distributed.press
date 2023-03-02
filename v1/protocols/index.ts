import { IPFSProtocol, IPFSProtocolOptions } from './ipfs.js'
import { HyperProtocol, HyperProtocolOptions } from './hyper.js'
import { HTTPProtocol, HTTPProtocolOptions } from './http.js'
import Protocol from './interfaces.js'
import { Static } from '@sinclair/typebox'
import { HTTPProtocolFields, HyperProtocolFields, IPFSProtocolFields } from '../api/schemas.js'

interface ProtocolOptions {
  ipfs: IPFSProtocolOptions
  hyper: HyperProtocolOptions
  http: HTTPProtocolOptions
}

export interface ProtocolManager {
  http: Protocol<Static<typeof HTTPProtocolFields>>
  ipfs: Protocol<Static<typeof IPFSProtocolFields>>
  hyper: Protocol<Static<typeof HyperProtocolFields>>
}

export class ConcreteProtocolManager implements ProtocolManager {
  http: HTTPProtocol
  ipfs: IPFSProtocol
  hyper: HyperProtocol

  constructor (options: ProtocolOptions) {
    this.ipfs = new IPFSProtocol(options.ipfs)
    this.http = new HTTPProtocol(options.http)
    this.hyper = new HyperProtocol(options.hyper)
  }

  async load (): Promise<void> {
    const promises = [
      this.ipfs.load(),
      this.hyper.load(),
      this.http.load()
    ]
    await Promise.all(promises)
  }

  async unload (): Promise<void> {
    const promises = [
      this.ipfs.unload(),
      this.hyper.unload(),
      this.http.unload()
    ]
    await Promise.all(promises)
  }
}
