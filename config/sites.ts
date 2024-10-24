import { NewSite, Site, UpdateSite, SiteStats } from '../api/schemas.js'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { AbstractLevel } from 'abstract-level'
import { ProtocolManager } from '../protocols/index.js'
import { Ctx } from '../protocols/interfaces.js'
import isValidHostname from 'is-valid-hostname'
import createError from 'http-errors'
import { promisify } from 'node:util'
import child_process from 'node:child_process'
import path from 'node:path'
const exec = promisify(child_process.exec)

export class SiteConfigStore extends Config<Static<typeof Site>> {
  protocols: ProtocolManager

  constructor (db: AbstractLevel<any, string, any>, protocols: ProtocolManager) {
    super(db)
    this.protocols = protocols
  }

  async create (cfg: Static<typeof NewSite>): Promise<Static<typeof Site>> {
    const id = cfg.domain
    if (!isValidHostname(id)) {
      throw createError(400, 'Invalid hostname. Please ensure you leave out the port and protocol specifiers (e.g. no https://)')
    }

    const obj: Static<typeof Site> = {
      ...cfg,
      public: cfg.public ?? false, // default public to false if not provided
      id,
      links: {}
    }
    return await this.db.put(id, obj).then(() => obj)
  }

  async clone (siteId: string, filePath: string, ctx?: Ctx): Promise<void> {
    const cwd = path.resolve(filePath, '..')
    const destination = filePath.split(path.sep).at(-1) as string

    await exec(`wget2 \
  --random-wait \
  --retry-on-http-error=503,504,429 \
  --compression=identity,gzip,br \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0" \
  --mirror \
  --page-requisites \
  --convert-links \
  --adjust-extension \
  --continue \
  --no-host-directories \
  --directory-prefix=${destination} \
  "https://${siteId}"`, { cwd })

    await this.sync(siteId, filePath)
  }

  async sync (siteId: string, filePath: string, ctx?: Ctx): Promise<void> {
    const site = await this.get(siteId)

    const promises = []
    if (site.protocols.http) {
      const promise = this.protocols.http
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.http = protocolLinks
        })

      promises.push(promise)
    }

    if (site.protocols.hyper) {
      const promise = this.protocols.hyper
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.hyper = protocolLinks
        })

      promises.push(promise)
    }

    if (site.protocols.ipfs) {
      const promise = this.protocols.ipfs
        .sync(siteId, filePath, undefined, ctx)
        .then((protocolLinks) => {
          site.links.ipfs = protocolLinks
        })

      promises.push(promise)
    }

    await Promise.all(promises)
    await this.db.put(siteId, site)
  }

  /// Updates status of protocols for a given site
  async update (id: string, cfg: Static<typeof UpdateSite>): Promise<void> {
    const old = await this.get(id)
    const site: Static<typeof Site> = {
      ...old,
      ...cfg
    }
    return await this.db.put(id, site)
  }

  async get (id: string): Promise<Static<typeof Site>> {
    return await this.db.get(id)
  }

  async listAll (hidePrivate: boolean): Promise<string[]> {
    const ids = await this.keys()
    if (!hidePrivate) {
      return ids
    } else {
      const sites = await Promise.all(ids.map(async id => await this.get(id)))
      return sites.filter(site => site.public).map(site => site.id)
    }
  }

  async delete (id: string, ctx?: Ctx): Promise<void> {
    const site = await this.get(id)

    const promises = []
    if (site.links.http != null) {
      promises.push(this.protocols.http.unsync(id, site.links.http, ctx))
    }
    if (site.links.ipfs != null) {
      promises.push(this.protocols.ipfs.unsync(id, site.links.ipfs, ctx))
    }
    if (site.links.hyper != null) {
      promises.push(this.protocols.hyper.unsync(id, site.links.hyper, ctx))
    }

    await Promise.all(promises)
    await this.db.del(id)
  }

  async stats (id: string): Promise<Static<typeof SiteStats>> {
    const hyper = await this.protocols.hyper.stats(id)
    const ipfs = await this.protocols.ipfs.stats(id)

    return {
      hyper,
      ipfs
    }
  }
}
