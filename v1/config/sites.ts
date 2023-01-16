import { NewSite, ProtocolStatus, Site } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'
import { AbstractLevel } from 'abstract-level'
import { HTTPProtocol } from '../protocols/http.js'

export class SiteConfigStore extends Config<Static<typeof Site>> {
  http: HTTPProtocol
  constructor (db: AbstractLevel<any, string, any>) {
    super(db)
    this.http = new HTTPProtocol()
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
    const site = await this.get(siteId)
    if (site.protocols.http) {
      await this.http.sync(siteId, filePath)
    }
    // TODO(protocol): repeat for IPFS and Hyper once implemented
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
    const site = await this.get(id)

    // TODO(protocol): repeat for IPFS and Hyper once implemented
    if (site.links.http != null) {
      await this.http.unsync(site.links.http)
    }

    await this.db.del(id)
  }
}
