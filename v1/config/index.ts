import { AbstractLevel } from 'abstract-level'
import envPaths from 'env-paths'
import { APIConfig } from '../api/index.js'
import { SiteFileSystem } from '../fs/index.js'
import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { RevocationStore } from './revocations.js'
import { SiteConfigStore } from './sites.js'

const paths = envPaths('distributed-press')

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

  constructor (cfg: APIConfig, db: AbstractLevel<any, string, any>) {
    this.db = db
    this.fs = new SiteFileSystem(cfg.storage ?? paths.temp)
    this.admin = new AdminStore(this.db.sublevel('admin', { valueEncoding: 'json' }))
    this.publisher = new PublisherStore(this.db.sublevel('publisher', { valueEncoding: 'json' }))
    this.sites = new SiteConfigStore(this.db.sublevel('sites', { valueEncoding: 'json' }))
    this.revocations = new RevocationStore(this.db.sublevel('revocations', { valueEncoding: 'json' }))
  }
}
