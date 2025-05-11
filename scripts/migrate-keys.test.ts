import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { migrateIPNSKeys } from './migrate-keys.js'

test('migrate keys successfully', async t => {
  const tempDir = path.join(process.cwd(), 'temp', nanoid())
  const kuboRepoPath = path.join(tempDir, 'kubo')
  const heliaKeysPath = path.join(tempDir, 'helia', 'keys')
  const kuboKeystorePath = path.join(kuboRepoPath, 'keystore')

  // Create directories and a dummy key
  await fs.mkdir(kuboKeystorePath, { recursive: true })
  const dummyKey = 'dummy-key'
  const dummyKeyPath = path.join(kuboKeystorePath, dummyKey)
  await fs.writeFile(dummyKeyPath, 'dummy key content')

  // Run migration
  await migrateIPNSKeys(kuboRepoPath, heliaKeysPath)

  // Check if the key was copied
  const migratedKeyPath = path.join(heliaKeysPath, dummyKey)
  const exists = await fs.access(migratedKeyPath).then(() => true).catch(() => false)
  t.true(exists, 'Key should be migrated to helia keys path')

  // Verify content
  const content = await fs.readFile(migratedKeyPath, 'utf8')
  t.is(content, 'dummy key content', 'Migrated key content should match original')

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true })
})

test('handle missing kubo keystore gracefully', async t => {
  const tempDir = path.join(process.cwd(), 'temp', nanoid())
  const kuboRepoPath = path.join(tempDir, 'kubo')
  const heliaKeysPath = path.join(tempDir, 'helia', 'keys')

  // Do not create kuboKeystorePath
  await t.throwsAsync(migrateIPNSKeys(kuboRepoPath, heliaKeysPath), {
    instanceOf: Error,
    message: /ENOENT: no such file or directory/
  }, 'Should throw error for missing kubo keystore')

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true })
})
