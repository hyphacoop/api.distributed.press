declare module 'bt-fetch' {
  export type TorrentManagerOptions = Partial<{
    folder: string
    timeout: number
    reloadInterval: number
  }>

  export interface Torrent {
    infoHash: Buffer
    publicKey: Buffer
  }

  export type TorrentPublishOpts = Partial<{
    name: string
    comment: string
    createdBy: string
    creationDate: string
  }>

  export interface KeyPair {
    publicKey: string
    secretKey: string
  }

  export class TorrentManager {
    constructor (opts: TorrentManagerOptions)
    stopSeedingPublicKey (publicKey: string): Promise<boolean>
    republishPublicKey (publicKey: string, secretKey: string, opts: TorrentPublishOpts): Promise<Torrent>
    createKeypair (petname?: string): KeyPair
    destroy (): Promise<void>
  }
}
