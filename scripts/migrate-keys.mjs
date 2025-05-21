import { mkdir, readdir, copyFile } from 'fs/promises'
import path from 'path'
import process from 'process'

export async function migrate (srcRepo, destDir) {
  const srcKs = path.join(srcRepo, 'keystore')
  await mkdir(destDir, { recursive: true })

  for (const file of await readdir(srcKs)) {
    await copyFile(path.join(srcKs, file), path.join(destDir, file))
    console.log(`migrated: ${file}`)
  }
  console.log('done.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, src, dest] = process.argv
  if (!src || !dest) {
    console.error('usage: node migrate.mjs <kuboRepo> <heliaDir>')
    process.exit(1)
  }
  migrate(src, dest).catch(e => {
    console.error(e)
    process.exit(1)
  })
}
