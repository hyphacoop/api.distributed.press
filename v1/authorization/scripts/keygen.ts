import { generateKeyPairSync } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

fs.writeFileSync(path.join(__dirname, '..', 'keys', 'private.key'), privateKey)
fs.writeFileSync(path.join(__dirname, '..', 'keys', 'public.key'), publicKey)

