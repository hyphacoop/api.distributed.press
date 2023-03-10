import envPaths from 'env-paths'
import path from 'node:path'
import rmrf from 'rimraf'

const paths = envPaths('distributed-press')
const cachePath = paths.cache
const basePath = paths.data
const protocolStoragePath = path.join(basePath, 'protocols')

console.log('Removing cache')
rmrf.sync(cachePath)
console.log('Removing cached protocol config')
rmrf.sync(protocolStoragePath)
