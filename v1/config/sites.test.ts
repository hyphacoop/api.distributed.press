import test from 'ava'
import { DEFAULT_SITE_CFG, SiteConfigStore } from './sites.js'
import { MemoryLevel } from 'memory-level'

function newSiteConfigStore(): SiteConfigStore {
  return new SiteConfigStore(new MemoryLevel({ valueEncoding: 'json' }))
}

export const exampleSiteConfig = {
  domain: 'https://example.com',
  publication: {
    http: {},
    ipfs: {},
    hyper: {},
  }
}

test('create new siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id)
  t.deepEqual(result, {
    ...DEFAULT_SITE_CFG,
    ...exampleSiteConfig,
    id: site.id,
  })
})

test('update siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id)
  const updated = {
    ...result,
    domain: 'https://newdomain.org',
    publication: {
      ...result.publication,
      ipfs: {
        enabled: true
      }
    }
  }
  await cfg.update(site.id, updated)
  const newResult = await cfg.get(site.id)
  t.deepEqual(newResult, updated)
})

test('delete siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(site.id)
  t.is((await cfg.keys()).length, 0)
})
