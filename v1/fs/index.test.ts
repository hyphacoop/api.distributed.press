import test from 'ava'
import path from 'path'
import { SiteFileSystem } from './index.js'
import envPaths from 'env-paths'
import { nanoid } from 'nanoid'
import { fileURLToPath } from 'url'
import { exampleSiteConfig } from '../fixtures/siteConfig.js'
import fs from 'fs'

const paths = envPaths('distributed-press')
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const fixturePath = path.resolve(dirname, '..', 'fixtures', 'site.tar.gz')
const expectedFilePath = path.join('site', 'index.html')

function newTempTestPath (): string {
  return path.join(paths.temp, 'fs-test', nanoid())
}

test('basic file system test', async t => {
  const testPath = newTempTestPath()
  const sfs = new SiteFileSystem(testPath)
  await sfs.makeFolder(exampleSiteConfig.domain)
  await sfs.extract(fixturePath, exampleSiteConfig.domain)

  const fp = path.join(testPath, 'sites', exampleSiteConfig.domain, expectedFilePath)
  await t.notThrowsAsync(fs.promises.stat(fp), 'index.html exists where we expect it to')
  await sfs.clear(exampleSiteConfig.domain)
  await t.throwsAsync(fs.promises.stat(fp), undefined, 'files should not exist after clear')
})
