import fs from 'fs/promises'
import path from 'path'
import makeDir from 'make-dir'

export async function migrateIPNSKeys (kuboRepoPath: string, heliaKeysPath: string): Promise<void> {
  console.log('Migrating from', kuboRepoPath, 'to', heliaKeysPath)
  const kuboKeystorePath = path.join(kuboRepoPath, 'keystore')
  console.log('Kubo keystore path:', kuboKeystorePath)

  await makeDir(heliaKeysPath)
  console.log('Created helia keys path:', heliaKeysPath)

  const keyFiles = await fs.readdir(kuboKeystorePath)
  for (const keyFile of keyFiles) {
    const src = path.join(kuboKeystorePath, keyFile)
    const dest = path.join(heliaKeysPath, keyFile)
    await fs.copyFile(src, dest)
    console.log(`Migrated key: ${keyFile}`)
  }
  console.log('IPNS key migration completed successfully.')
}

// Example usage
/*
const kuboRepoPath = '/path/to/kubo/repo'
const heliaKeysPath = '/path/to/helia/keys'
migrateIPNSKeys(kuboRepoPath, heliaKeysPath)
*/
