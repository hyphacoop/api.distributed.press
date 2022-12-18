import { readFileSync } from 'fs'
import path from 'path'
import { createSigner } from 'fast-jwt'
import { makeAdmin } from '../jwt.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import makeDir from 'make-dir'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data

makeDir.sync(path.join(dataPath, 'keys'))
const secret = readFileSync(path.join(dataPath, 'keys', 'private.key'), 'utf8')
const signSync = createSigner({ key: secret })
const token = signSync(makeAdmin('root'))
console.log("Here's the 'root' admin JWT. Use this carefully! It can be used to create new publishers *and* admins.")
console.log('\nToken:')
console.log(token)
