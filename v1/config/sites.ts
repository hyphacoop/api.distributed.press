import { NewSite, ProtocolStatus, Site } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'
import { AbstractLevel } from 'abstract-level'
import { ProtocolManager } from '../protocols/index.js'

export class SiteConfigStore extends Config<Static<typeof Site>> {
  protocols?: ProtocolManager

  constructor (db: AbstractLevel<any, string, any>, protocols?: ProtocolManager) {
    super(db)
    this.protocols = protocols
  }

  async create (cfg: Static<typeof NewSite>): Promise<Static<typeof Site>> {
    const id = nanoid()
    const obj: Static<typeof Site> = {
      ...cfg,
      id,
      links: {}
    }
    return await this.db.put(id, obj).then(() => obj)
  }

  async sync (siteId: string, filePath: string): Promise<void> {
    if (this.protocols !== undefined) {
      const site = await this.get(siteId)
      // TODO: pipeline this with Promise.all
      site.links.http = site.protocols.http ? await this.protocols.http.sync(siteId, filePath) : undefined
      site.links.ipfs = site.protocols.ipfs ? await this.protocols.ipfs.sync(siteId, filePath) : undefined
      site.links.hyper = site.protocols.hyper ? await this.protocols.hyper.sync(siteId, filePath) : undefined
    }
  }

  /// Updates status of protocols for a given site
  async update (id: string, cfg: Static<typeof ProtocolStatus>): Promise<void> {
    const old = await this.get(id)
    const site = {
      ...old,
      protocols: cfg
    }
    return await this.db.put(id, site)
  }

  async get (id: string): Promise<Static<typeof Site>> {
    return await this.db.get(id)
  }

  async delete (id: string): Promise<void> {
    if (this.protocols !== undefined) {
      const site = await this.get(id)

      const promises = []
      if (site.links.http != null) {
        promises.push(this.protocols.http.unsync(id, site.links.http))
      }
      if (site.links.ipfs != null) {
        promises.push(this.protocols.ipfs.unsync(id, site.links.ipfs))
      }
      if (site.links.hyper != null) {
        promises.push(this.protocols.hyper.unsync(id, site.links.hyper))
      }

      await Promise.all(promises)
    }

    await this.db.del(id)
  }
}
