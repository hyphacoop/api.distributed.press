import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { migrate } from './migrate.mjs'

test('migrate keys successfully', async t => {
  const tempDir = path.join(process.cwd(), 'temp-migrate-test', nanoid())
  const srcRepoPath = path.join(tempDir, 'src', 'kubo')
  const destHeliaKeysPath = path.join(tempDir, 'dest', 'helia', 'keys')
  const srcKeystorePath = path.join(srcRepoPath, 'keystore')

  try {
    // Create directories and a dummy key in the source
    await fs.mkdir(srcKeystorePath, { recursive: true })
    const dummyKeyName = 'test-key'
    const dummyKeyContent = 'this is a test key'
    await fs.writeFile(path.join(srcKeystorePath, dummyKeyName), dummyKeyContent)

    // Ensure destination does not exist or is empty if it does
    await fs.rm(destHeliaKeysPath, { recursive: true, force: true }).catch(() => {}) // ignore error if not exists
    await fs.mkdir(destHeliaKeysPath, { recursive: true })

    // Run migration
    await migrate(srcRepoPath, destHeliaKeysPath)

    // Check if the key was copied
    const migratedKeyPath = path.join(destHeliaKeysPath, dummyKeyName)
    const exists = await fs.access(migratedKeyPath).then(() => true).catch(() => false)
    t.true(exists, 'Key should be migrated to the destination keys path')

    // Verify content
    if (exists) {
      const content = await fs.readFile(migratedKeyPath, 'utf8')
      t.is(content, dummyKeyContent, 'Migrated key content should match original')
    }
  } catch (err) {
    t.fail('Test failed during execution: ' + err.message)
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('migrate handles missing source keystore gracefully', async t => {
  const tempDir = path.join(process.cwd(), 'temp-migrate-test-missing-ks', nanoid())
  const srcRepoPath = path.join(tempDir, 'src', 'kubo') // Keystore will not be created here
  const destHeliaKeysPath = path.join(tempDir, 'dest', 'helia', 'keys')

  try {
    await fs.mkdir(destHeliaKeysPath, { recursive: true }) // Create destination

    // Attempt to run migration expecting it to fail
    await t.throwsAsync(
      migrate(srcRepoPath, destHeliaKeysPath),
      { instanceOf: Error }, // Check for a generic Error. Specific error checks can be added if needed.
      'Should throw an error when the source keystore directory is missing'
    )
  } catch (err) {
    // This catch is for errors in test setup itself, not for the expected error from migrate()
    t.fail('Test setup error or unexpected error during migrate execution: ' + err.message)
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
