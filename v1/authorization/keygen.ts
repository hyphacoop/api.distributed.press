import { generateKeyPairSync } from 'crypto'
import fs from 'fs'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  }
})

fs.writeFileSync('./authorization/keys/private.key', privateKey)
fs.writeFileSync('./authorization/keys/public.key', publicKey)

