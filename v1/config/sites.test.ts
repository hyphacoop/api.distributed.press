import test from 'ava'
import { SiteConfigStore } from './sites.js'
import { MemoryLevel } from 'memory-level'
import { NewSite } from '../api/schemas.js'
import { Static } from '@sinclair/typebox'

function newSiteConfigStore (): SiteConfigStore {
  return new SiteConfigStore(new MemoryLevel({ valueEncoding: 'json' }))
}

export const exampleSiteConfig: Static<typeof NewSite> = {
  domain: 'https://example.com',
  protocols: {
    http: true,
    ipfs: false,
    hyper: false
  }
}

test('create new siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id)
  t.deepEqual(result.protocols, exampleSiteConfig.protocols)
  t.is(result.domain, exampleSiteConfig.domain)
})

test('update siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const updated = {
    ...site.protocols,
    hyper: true
  }

  await cfg.update(site.id, updated)
  const newResult = await cfg.get(site.id)
  t.is(newResult.protocols.hyper, true)
})

test('delete siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(site.id)
  t.is((await cfg.keys()).length, 0)
})
