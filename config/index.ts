import { AbstractLevel } from 'abstract-level'
import { APIConfig } from '../api/index.js'
import { SiteFileSystem } from '../fs/index.js'
import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { RevocationStore } from './revocations.js'
import { SiteConfigStore } from './sites.js'
import path from 'path'
import { ProtocolManager } from '../protocols/index.js'

export interface StoreI {
  admin: AdminStore
  publisher: PublisherStore
  sites: SiteConfigStore
  revocations: RevocationStore
  fs: SiteFileSystem
}

export default class Store implements StoreI {
  db: AbstractLevel<any, string, any>
  public admin: AdminStore
  public publisher: PublisherStore
  public sites: SiteConfigStore
  public revocations: RevocationStore
  public fs: SiteFileSystem

  constructor (cfg: APIConfig, db: AbstractLevel<any, string, any>, protocols: ProtocolManager) {
    this.db = db

    const basePath = cfg.storage
    const siteStoragePath = path.join(basePath, 'sites')

    this.fs = new SiteFileSystem(siteStoragePath)
    this.admin = new AdminStore(this.db.sublevel('admin', { valueEncoding: 'json' }))
    this.publisher = new PublisherStore(this.db.sublevel('publisher', { valueEncoding: 'json' }))
    this.sites = new SiteConfigStore(this.db.sublevel('sites', { valueEncoding: 'json' }), protocols)
    this.revocations = new RevocationStore(this.db.sublevel('revocations', { valueEncoding: 'json' }))
  }
}
