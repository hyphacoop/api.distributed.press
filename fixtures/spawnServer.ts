import envPaths from 'env-paths'
import path from 'path'
import makeDir from 'make-dir'
import fs from 'fs'
import { generateKeyPair } from '../authorization/jwt.js'
import apiBuilder, { FastifyTypebox } from '../api/index.js'
import { nanoid } from 'nanoid'
import { BUILTIN } from '../protocols/ipfs.js'
import getPort from 'get-port'

const paths = envPaths('distributed-press')
export async function spawnTestServer (): Promise<FastifyTypebox> {
  const storagePath = path.join(paths.temp, 'tests', nanoid())
  const { privateKey, publicKey } = generateKeyPair()
  makeDir.sync(path.join(storagePath, 'keys'))
  makeDir.sync(path.join(storagePath, 'protocols'))
  fs.writeFileSync(path.join(storagePath, 'keys', 'private.key'), privateKey)
  fs.writeFileSync(path.join(storagePath, 'keys', 'public.key'), publicKey)
  return await apiBuilder({
    useMemoryBackedDB: true,
    port: 8080,
    dnsport: await getPort(),
    host: 'localhost',
    storage: storagePath,
    ipfsProvider: BUILTIN
  })
}
