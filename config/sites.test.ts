import test from 'ava'
import { exampleSiteConfig, newSiteConfigStore } from '../fixtures/siteConfig.js'
import { tmpdir } from 'node:os'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import rimraf from 'rimraf'

test('create new siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const result = await cfg.get(site.id)
  t.deepEqual(result.protocols, exampleSiteConfig.protocols)
  t.is(result.domain, exampleSiteConfig.domain)
})

test('sites are default private', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create({
    domain: 'example.com',
    protocols: {
      http: true,
      ipfs: false,
      hyper: false
    }
  })
  const result = await cfg.get(site.id)
  t.is(result.public, false)
})

test('create new siteconfig with bad hostname should fail', async t => {
  const cfg = newSiteConfigStore()
  await t.throwsAsync(cfg.create({
    ...exampleSiteConfig,
    domain: 'https://hashostname.com'
  }))
  await t.throwsAsync(cfg.create({
    ...exampleSiteConfig,
    domain: 'hasport.com:3030'
  }))
})

test('update siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  const updated = {
    protocols: {
      ...site.protocols,
      hyper: true
    }
  }

  await cfg.update(site.id, updated)
  const newResult = await cfg.get(site.id)
  t.is(newResult.protocols.hyper, true)
  t.is(newResult.public, true)

  await cfg.update(site.id, {
    public: false
  })
  const newResult2 = await cfg.get(site.id)
  t.is(newResult2.public, false)
})

test('delete siteconfig', async t => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create(exampleSiteConfig)
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(site.id)
  t.is((await cfg.keys()).length, 0)
})

test('listAll siteconfig', async t => {
  const cfg = newSiteConfigStore()
  await cfg.create({
    ...exampleSiteConfig,
    domain: 'site1.com'
  })
  await cfg.create({
    ...exampleSiteConfig,
    domain: 'site2.com'
  })
  await cfg.create({
    ...exampleSiteConfig,
    domain: 'site3.com',
    public: false
  })
  t.is((await cfg.listAll(true)).length, 2)
  t.is((await cfg.listAll(false)).length, 3)
})

test('clone a site', async (t) => {
  const cfg = newSiteConfigStore()
  const site = await cfg.create({ ...exampleSiteConfig, domain: 'staticpub.mauve.moe' })

  const id = site.domain
  const dir = join(tmpdir(), id)

  try {
    await cfg.clone(id, dir)

    const files = await readdir(dir)

    t.assert(files.length !== 0, 'Site got cloned')
  } finally {
    await rimraf(dir)
  }
})
