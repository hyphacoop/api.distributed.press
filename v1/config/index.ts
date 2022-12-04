import { AdminStore } from './admin.js'
import { PublisherStore } from './publisher.js'
import { SiteConfigStore } from './sites.js'
import { makeDB } from './store.js'

const db = makeDB()

export default {
  admin: new AdminStore(db),
  publisher: new PublisherStore(db),
  sites: new SiteConfigStore(db)
}
