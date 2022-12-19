import { AbstractLevel } from 'abstract-level'
import { Level } from 'level'
import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { SiteConfigStore } from './sites.js'

const defaultDB = (): Level<string, string> => new Level('store', { valueEncoding: 'json' })

export interface StoreI {
  admin: AdminStore
  publisher: PublisherStore
  sites: SiteConfigStore
}

export default class Store implements StoreI {
  db: AbstractLevel<any, string, any>
  public admin: AdminStore
  public publisher: PublisherStore
  public sites: SiteConfigStore

  constructor (db?: AbstractLevel<any, string, any>) {
    this.db = db ?? defaultDB()
    this.admin = new AdminStore(this.db.sublevel('admin'))
    this.publisher = new PublisherStore(this.db.sublevel('publisher'))
    this.sites = new SiteConfigStore(this.db.sublevel('sites'))
  }
}
