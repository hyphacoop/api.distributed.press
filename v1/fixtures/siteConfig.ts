import { Static } from '@sinclair/typebox'
import { MemoryLevel } from 'memory-level'
import { NewSite } from '../api/schemas.js'
import { SiteConfigStore } from '../config/sites.js'

export function newSiteConfigStore (): SiteConfigStore {
  return new SiteConfigStore(new MemoryLevel({ valueEncoding: 'json' }))
}

export const exampleSiteConfig: Static<typeof NewSite> = {
  domain: 'example.com',
  protocols: {
    http: true,
    ipfs: false,
    hyper: false
  }
}
