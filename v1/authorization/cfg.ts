import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { FastifyTypebox } from '../api/index.js'
import { JWTPayload, JWTPayloadT } from './jwt.js'
import { FastifyRequest, FastifyReply, DoneFuncWithErrOrRes } from 'fastify'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Value } from '@sinclair/typebox/value'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data

const genericVerify = (accountType: 'admin' | 'publisher') => (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (request.raw.headers.auth === undefined) {
    return done(new Error('Missing token header'))
  }

  request.jwtVerify<JWTPayloadT>().then((decoded) => {
    if (!Value.Check(JWTPayload, decoded)) {
      return done(new Error('Malformed JWT Payload'))
    }
    if (decoded.account.type !== accountType) {
      return done(new Error(`Mismatched account type: got ${decoded.account.type}, wanted ${accountType}`))
    }
    if (decoded.expires < (new Date).getTime() && decoded.expires !== -1) {
      return done(new Error('JWT token has expired. Please get a new one using a refresh token'))
    }
    return done()
  }).catch(() => done(new Error('Cannot verify JWT')))
}

export const registerAuth = async (route: FastifyTypebox): Promise<void> => {
  await route.register(jwt, {
    secret: {
      private: readFileSync(path.join(dataPath, 'keys', 'private.key'), 'utf8'),
      public: readFileSync(path.join(dataPath, 'keys', 'public.key'), 'utf8')
    },
    sign: { algorithm: 'RS256' }
  })
  await route.register(auth)
  route.decorate('verifyAdmin', genericVerify('admin'))
  route.decorate('verifyPublisher', genericVerify('publisher'))
  return await route.after()
}
