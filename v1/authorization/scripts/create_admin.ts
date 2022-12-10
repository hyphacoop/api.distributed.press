import { readFileSync } from 'fs'
import path from 'path'
import {createSigner} from 'fast-jwt'
import { fileURLToPath } from 'url';
import { makeAdmin } from '../jwt.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const secret = readFileSync(path.join(__dirname, '..', 'keys', 'private.key'), 'utf8')
const signSync = createSigner({ key: secret })
const token = signSync(makeAdmin("root"))
console.log("Here's the 'root' admin JWT. Use this carefully! It can be used to create new publishers *and* admins.")
console.log("\nToken:")
console.log(token)
