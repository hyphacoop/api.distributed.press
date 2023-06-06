import anyTest, { TestFn } from 'ava'
import envPaths from 'env-paths'
import makeDir from 'make-dir'
import { nanoid } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'
import { exampleSiteConfig } from '../fixtures/siteConfig.js'
import { HyperProtocol } from './hyper.js'
import Protocol from './interfaces.js'
import { BUILTIN, IPFSProtocol } from './ipfs.js'
import { BitTorrentProtocol } from './bittorrent.js'

const paths = envPaths('distributed-press')
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const fixturePath = path.resolve(dirname, '..', 'fixtures', 'site')

async function newProtocolTestPath (): Promise<string> {
  const p = path.join(paths.temp, 'protocol-test', nanoid())
  await makeDir(p)
  return p
}

const test = anyTest as TestFn<{ protocol: Protocol<any> }>
test.afterEach.always(async t => {
  await t.context.protocol?.unload()
})

test('ipfs: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  t.context.protocol = new IPFSProtocol({
    path,
    provider: BUILTIN
  })

  await t.notThrowsAsync(t.context.protocol.load(), 'initializing IPFS should work')
  const links = await t.context.protocol.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true)
  t.truthy(links.link)
})

test('hyper: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  t.context.protocol = new HyperProtocol({
    path
  })

  await t.notThrowsAsync(t.context.protocol.load(), 'initializing hyper should work')
  const links = await t.context.protocol.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true)
  t.truthy(links.link)
})

test('bittorrent: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  t.context.protocol = new BitTorrentProtocol({
    path
  })

  await t.notThrowsAsync(t.context.protocol.load(), 'initializing bittorrent should work')
  const links = await t.context.protocol.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true)
  t.truthy(links.link)
})
