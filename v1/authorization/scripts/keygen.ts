import { generateKeyPairSync } from 'crypto'
import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import makeDir from 'make-dir'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
})

makeDir.sync(path.join(dataPath, 'keys'))
fs.writeFileSync(path.join(dataPath, 'keys', 'private.key'), privateKey)
fs.writeFileSync(path.join(dataPath, 'keys', 'public.key'), publicKey)
console.log(`Wrote keys to ${dataPath}`)
