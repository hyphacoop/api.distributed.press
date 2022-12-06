import { AbstractLevel } from 'abstract-level'
import { Level } from 'level'
import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { SiteConfigStore } from './sites.js'

const defaultDB = () => new Level('./store', { valueEncoding: 'json' })

export interface StoreI {
  admin: AdminStore,
  publisher: PublisherStore,
  sites: SiteConfigStore,
}

export default class Store implements StoreI {
  public admin: AdminStore
  public publisher: PublisherStore
  public sites: SiteConfigStore

  constructor(db: AbstractLevel<any, string, any> = defaultDB()) {
    this.admin = new AdminStore(db.sublevel("admin"));
    this.publisher = new PublisherStore(db.sublevel("publisher"));
    this.sites = new SiteConfigStore(db.sublevel("sites"));
  }
}

