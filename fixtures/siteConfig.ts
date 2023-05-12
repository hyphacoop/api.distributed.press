import { Static } from '@sinclair/typebox'
import { MemoryLevel } from 'memory-level'
import { NewSite } from '../api/schemas.js'
import { SiteConfigStore } from '../config/sites.js'
import { MockProtocolManager } from './mockProtocols.js'

export function newSiteConfigStore (): SiteConfigStore {
  return new SiteConfigStore(new MemoryLevel({ valueEncoding: 'json' }), new MockProtocolManager())
}

export const exampleSiteConfig: Static<typeof NewSite> = {
  domain: 'example.com',
  protocols: {
    http: true,
    ipfs: false,
    hyper: false
  },
  public: true
}
