import envPaths from 'env-paths'
import path from 'path'
import { JsIpfs } from '../protocols/ipfs.js'
import makeDir from 'make-dir'
import fs from 'fs'
import { generateKeyPair } from '../authorization/jwt.js'
import apiBuilder from '../api/index.js'

const paths = envPaths('distributed-press')
export function spawnTestServer() {
  const storagePath = path.join(paths.temp, 'tests')
  const { privateKey, publicKey } = generateKeyPair()
  makeDir.sync(path.join(storagePath, 'keys'))
  fs.writeFileSync(path.join(storagePath, 'keys', 'private.key'), privateKey)
  fs.writeFileSync(path.join(storagePath, 'keys', 'public.key'), publicKey)
  return apiBuilder({
    useMemoryBackedDB: true,
    port: 8080,
    host: 'localhost',
    storage: storagePath,
    ipfsProvider: JsIpfs,
    dns: {
      server: '127.0.0.1:53',
      domains: []
    }
  })
}
