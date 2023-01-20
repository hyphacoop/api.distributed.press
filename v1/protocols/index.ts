import { IPFSProtocol, IPFSProtocolOptions } from './ipfs.js'
import { HyperProtocol, HyperProtocolOptions } from './hyper.js'
import { HTTPProtocol, HTTPProtocolOptions } from './http.js'

interface ProtocolOptions {
  ipfs: IPFSProtocolOptions
  hyper: HyperProtocolOptions
  http: HTTPProtocolOptions
}

export class ProtocolManager {
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
      this.hyper.load()
    ]
    await Promise.all(promises)
  }
}
