import {Protocol} from "./interfaces.ts"

interface IPFSOptions {
  ipfsInstance: Any
}

class IPFSProtocol extends Protocol{
  constructor (options: IPFSOptions) {
    // Save options
  }
  async load () {
    // Init JS-IPFS
    // We don't need to initialize individual sites since that's handled by MFS/IPNS
  }
  async create<T>(config: T) {
    // Take the site name to make an IPNS key and an MFS directory
    // Return the URLs to use and the _dnslink record to serve
  }
  async sync (info: Static<typeof Site>, folder: string, options: SyncOptions) {
    // Sync folder to MFS
    // Update the IPNS entry
  }
  async delete (info: Static<typeof Site>) {
    // Delete the IPNS key
    // Delete the MFS folder
  }
}

