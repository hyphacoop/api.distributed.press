import { Static } from '@sinclair/typebox'
import Protocol, { Ctx, SyncOptions } from './interfaces'
import { BitTorrentProtocolFields } from '../api/schemas'

import path from 'node:path'
import { cp } from 'node:fs/promises'

import { TorrentManager } from 'bt-fetch'

export interface BitTorrentProtocolOptions {
  path: string
}

export class BitTorrentProtocol implements Protocol<Static<typeof BitTorrentProtocolFields>> {
  options: BitTorrentProtocolOptions
  manager: TorrentManager | null

  constructor (options: BitTorrentProtocolOptions) {
    this.options = options
    this.manager = null
  }

  async load (): Promise<void> {
    const folder = this.options.path
    this.manager = new TorrentManager({ folder })
  }

  async unload (): Promise<void> {
    await this.manager?.destroy()
  }

  async sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<Static<typeof BitTorrentProtocolFields>> {
    ctx?.logger.info('[bittorrent] Sync Start')

    const link = `bittorent://${id}/`

    if (this.manager === null) {
      throw new Error('[bittorrent] Torrent Manager Not Initialized')
    }

    const manager: TorrentManager = this.manager

    // Create keypair from the site ID and the seed key
    const { publicKey, secretKey } = manager.createKeypair(id)

    const storageFolder = path.join(this.options.path, 'data', publicKey, id)

    const torrentInfo = {
      name: id,
      comment: `Content for ${link}`,
      createdBy: 'distributed.press'
    }

    ctx?.logger.info('[bittorrent] Stop seeding existing')

    await manager.stopSeedingPublicKey(publicKey)

    ctx?.logger.info('[bittorrent] Copy data to storage')

    await cp(folderPath + path.sep, storageFolder + path.sep, { recursive: true })

    ctx?.logger.info('[bittorrent] Generate new torrent and publish to DHT')

    // Pass folder and options
    const torrent = await manager.republishPublicKey(publicKey, secretKey, torrentInfo)

    const infoHash = torrent.infoHash.toString('hex')

    const subdomain = id.replaceAll('-', '--').replaceAll('.', '-')
    // TODO: Pass in gateway from config
    const gateway = `https://${subdomain}.bt.hypha.coop/`

    const magnet = `magnet:?xt:urn:btih:${infoHash}&xs=urn:btpk:${publicKey}`

    const infoHashURL = `bittorrent://${infoHash}/`
    const publicKeyURL = `bittorrent://${publicKey}/`

    ctx?.logger.info(`[bittorrent] Published: ${link}`)

    const dnslink = `/bt/${publicKey}`
    return {
      enabled: true,
      link,
      gateway,
      infoHash: infoHashURL,
      pubKey: publicKeyURL,
      magnet,
      dnslink
    }
  }

  async unsync (id: string, _site: Static<typeof BitTorrentProtocolFields>, ctx?: Ctx): Promise<void> {
  }
}
