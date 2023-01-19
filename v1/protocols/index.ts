
import { IPFSProtocol, IPFSProtocolOptions } from './ipfs'
import { HyperProtocol, HyperProtocolOptions } from './hyper'

import envPaths from 'env-paths'
import path from 'node:path'

const paths = envPaths('distributed-press')
const DEFAULT_STORAGE_LOCATION = path.join(paths.data, 'protocols')

interface ProtocolOptions {
  ipfs?: IPFSProtocolOptions
  hyper?: Any
}

export class Protocols {
  #ipfs = null
  #hyper = null

  constructor (storagePath = DEFAULT_STORAGE_LOCATION, { ipfs = null, hyper = null } = {}) {
    let ipfsOptions = ipfs
    if (ipfsOptions && !ipfsOptions.path) {
      ipfsOptions = {
        ...ipfsOptions,
        path: path.join(storagePath, 'ipfs')
      }
    }

    if (ipfsOptions) {
      this.ipfs = new IPFSProtocol(ipfsOptions)
    }
  }

  async load () {
    const promises = []
    if (this.ipfs != null) {
      promises.push(this.ipfs.load())
    }

    if (this.hyper) {
      promises.push(this.hyper.load())
    }

    await Promise.all(promises)
  }

  public get ipfs (): IPFSProtocol | null {
    return this.#ipfs
  }

  public get hyper () {
    return this.#hyper
  }
}
