import { Level } from 'level'
import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { SiteConfigStore } from './sites.js'

const db = new Level('./store', { valueEncoding: 'json' })
export default {
  admin: new AdminStore(db.sublevel("admin")),
  publisher: new PublisherStore(db.sublevel("publisher")),
  sites: new SiteConfigStore(db.sublevel("sites"))
}
