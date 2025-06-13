// Polyfill CustomEvent for Node.js environment
// Shim Web Crypto API to global scope for browser-compatible libraries
import { webcrypto } from 'node:crypto'

import anyTest, { TestFn } from 'ava'
import envPaths from 'env-paths'
import makeDir from 'make-dir'
import { nanoid } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'
import { exampleSiteConfig } from '../fixtures/siteConfig.js'
import { HyperProtocol } from './hyper.js'
import Protocol from './interfaces.js'
import { IPFSProtocol } from './ipfs.js'

if (typeof CustomEvent === 'undefined') {
  class CustomEvent<T = any> extends Event {
    detail: T
    constructor (type: string, options?: CustomEventInit<T>) {
      super(type, options)
      this.detail = options?.detail as T
    }
  }
  (globalThis as any).CustomEvent = CustomEvent
}
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto
}

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
  // Disable WebRTC in CI by checking process.env.CI
  const useWebRTC = process.env.CI !== 'true'
  t.context.protocol = new IPFSProtocol({ path, useWebRTC })
  await t.context.protocol.load()
  await t.notThrowsAsync(t.context.protocol.load(), 'initializing IPFS with Helia should work')
  const links = await t.context.protocol.sync(exampleSiteConfig.domain, fixturePath)
  console.log('IPFS Sync Result:', JSON.stringify(links, null, 2))
  t.is(links.enabled, true, 'sync should enable the site')
  t.truthy(links.link, 'sync should provide a valid IPNS link')
  t.regex(links.link, /^ipns:\/\//, 'link should be an IPNS URL')
})

test('hyper: basic e2e sync', async t => {
  const path = await newProtocolTestPath()
  t.context.protocol = new HyperProtocol({ path })

  await t.notThrowsAsync(t.context.protocol.load(), 'initializing hyper should work')
  const links = await t.context.protocol.sync(exampleSiteConfig.domain, fixturePath)
  t.is(links.enabled, true, 'sync should enable the site')
  t.truthy(links.link, 'sync should provide a valid link')
})
