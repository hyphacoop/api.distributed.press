import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { FastifyTypebox } from '../api/index.js'
import { CAPABILITIES, JWTPayload, JWTPayloadT, subset } from './jwt.js'
import { FastifyRequest, FastifyReply, DoneFuncWithErrOrRes } from 'fastify'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Value } from '@sinclair/typebox/value/index.js'
import { StoreI } from '../config/index.js'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data

function printCapabilities (capabilities: CAPABILITIES[]): string {
  return capabilities.map(cap => cap.toString()).join(', ')
}

const verifyTokenCapabilities = (store: StoreI, capabilities: CAPABILITIES[]) => (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (request.raw.headers.authorization === undefined) {
    return done(new Error('Missing token header'))
  }
  request.jwtVerify<JWTPayloadT>().then((decoded) => {
    if (!Value.Check(JWTPayload, decoded)) {
      return done(new Error('Malformed JWT Payload'))
    }
    if (!subset(capabilities, decoded.capabilities)) {
      return done(new Error(`Mismatched capabilities: got ${printCapabilities(decoded.capabilities)}, wanted ${printCapabilities(capabilities)}`))
    }
    if (decoded.expires !== -1 && decoded.expires < (new Date()).getTime()) {
      return done(new Error('JWT token has expired, please refresh it'))
    }

    store.revocations.isRevoked(decoded).then(isRevoked => {
      if (isRevoked) {
        return done(new Error('JWT token has been revoked'))
      } else {
        return done()
      }
    }).catch((err: string) => done(new Error(`Failed to check whether token was revoked: ${err}`)))
  }).catch((err: string) => done(new Error(`Cannot verify access token JWT: ${err}`)))
}

export const registerAuth = async (route: FastifyTypebox, store: StoreI): Promise<void> => {
  await route.register(jwt, {
    secret: {
      private: readFileSync(path.join(dataPath, 'keys', 'private.key'), 'utf8'),
      public: readFileSync(path.join(dataPath, 'keys', 'public.key'), 'utf8')
    },
    sign: { algorithm: 'RS256' }
  })
  await route.register(auth)
  route.decorate('verifyAdmin', verifyTokenCapabilities(store, [CAPABILITIES.ADMIN]))
  route.decorate('verifyPublisher', verifyTokenCapabilities(store, [CAPABILITIES.PUBLISHER]))
  route.decorate('verifyRefresh', verifyTokenCapabilities(store, [CAPABILITIES.REFRESH]))
  return route.after()
}
