import test from 'ava'
import { SiteConfigStore } from './sites.js'
import { MemoryLevel } from 'memory-level'

function newSiteConfigStore(): SiteConfigStore {
  return new SiteConfigStore(new MemoryLevel({ valueEncoding: 'json' }))
}

const exampleSiteConfig = {
  domain: "https://example.com",
  dns: {
    server: "some_dns_server",
    domains: [],
  },
  links: {}
}

test('create new siteconfig', async t => {
  const cfg = newSiteConfigStore();
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id);
  t.deepEqual(result, {
    ...exampleSiteConfig,
    id: site.id,
    publication: {
      http: {},
      hyper: {},
      ipfs: {},
    },
  })
})

test('update siteconfig', async t => {
  const cfg = newSiteConfigStore();
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id);
  const updated = {
    ...result,
    domain: "https://newdomain.org",
    publication: {
      ...result.publication,
      ipfs: {
        enabled: true,
      }
    }
  }
  await cfg.update(site.id, updated);
  const new_result = await cfg.get(site.id);
  t.deepEqual(new_result, updated)
})

test('delete siteconfig', async t => {
  const cfg = newSiteConfigStore();
  const site = await cfg.create(exampleSiteConfig)
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(site.id)
  t.is((await cfg.keys()).length, 0)
})

