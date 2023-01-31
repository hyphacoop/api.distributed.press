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

  async load (): Promise<void[]> {
    const promises = [
      this.ipfs.load(),
      // TODO(@mauve, @jacky): figure out why this cases segfaults and uv_loop complaining about too many open handles 
      // this.hyper.load(),
      this.http.load()
    ]
    return await Promise.all(promises)
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
