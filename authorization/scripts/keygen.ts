import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import makeDir from 'make-dir'
import { generateKeyPair } from '../jwt.js'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data
const { privateKey, publicKey } = generateKeyPair()
makeDir.sync(path.join(dataPath, 'keys'))
fs.writeFileSync(path.join(dataPath, 'keys', 'private.key'), privateKey)
fs.writeFileSync(path.join(dataPath, 'keys', 'public.key'), publicKey)
console.log(`Wrote keys to ${dataPath}`)
