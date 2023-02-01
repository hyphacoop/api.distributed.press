import test from 'ava'
import envPaths from 'env-paths'
import makeDir from 'make-dir'
import { nanoid } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'
import { exampleSiteConfig } from '../fixtures/siteConfig.js'
import { HyperProtocol } from './hyper.js'
import { BUILTIN, IPFSProtocol } from './ipfs.js'

const paths = envPaths('distributed-press')
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const fixturePath = path.resolve(dirname, '..', 'fixtures', 'site')

async function newProtocolTestPath (): Promise<string> {
  const p = path.join(paths.temp, 'protocol-test', nanoid())
  await makeDir(p)
  return p
}

test('ipfs: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  const ipfs = new IPFSProtocol({
    path,
    provider: BUILTIN
  })

  await t.notThrowsAsync(ipfs.load(), 'initializing IPFS should work')
  const links = await ipfs.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true)
  t.truthy(links.link)
})

test('hyper: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  const hyper = new HyperProtocol({
    path
  })

  await t.notThrowsAsync(hyper.load(), 'initializing hyper should work')
  const links = await hyper.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true)
  t.truthy(links.link)
})
