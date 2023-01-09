import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { APIConfig, FastifyTypebox } from '../api/index.js'
import { CAPABILITIES, generateKeyPair, JWTPayload, JWTPayloadT, subset } from './jwt.js'
import { FastifyRequest, FastifyReply, DoneFuncWithErrOrRes } from 'fastify'
import { Value } from '@sinclair/typebox/value/index.js'
import { StoreI } from '../config/index.js'

function printCapabilities (capabilities: CAPABILITIES[]): string {
  return capabilities.map(cap => cap.toString()).join(', ')
}

const verifyTokenCapabilities = (store: StoreI, capabilities: CAPABILITIES[]) => async (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (request.raw.headers.authorization === undefined) {
    return done(new Error('Missing token header'))
  }
  try {
    const decoded = await request.jwtVerify<JWTPayloadT>()
    if (!Value.Check(JWTPayload, decoded)) {
      return done(new Error('Malformed JWT Payload'))
    }
    if (!subset(capabilities, decoded.capabilities)) {
      return done(new Error(`Mismatched capabilities: got ${printCapabilities(decoded.capabilities)}, wanted ${printCapabilities(capabilities)}`))
    }
    if (decoded.expires !== -1 && decoded.expires < (new Date()).getTime()) {
      return done(new Error('JWT token has expired, please refresh it'))
    }
    const isRevoked = await store.revocations.isRevoked(decoded)
    if (isRevoked) {
      return done(new Error('JWT token has been revoked'))
    } else {
      return done()
    }
  } catch (error) {
    return done(new Error(`Cannot verify access token JWT: ${error as string}`))
  }
}

export const registerAuth = async (cfg: APIConfig, route: FastifyTypebox, store: StoreI): Promise<void> => {
  let keys
  if (cfg.storage !== undefined) {
    keys = {
      private: readFileSync(path.join(cfg.storage, 'keys', 'private.key'), 'utf8'),
      public: readFileSync(path.join(cfg.storage, 'keys', 'public.key'), 'utf8')
    }
  } else {
    const { privateKey, publicKey } = generateKeyPair()
    keys = {
      private: privateKey,
      public: publicKey
    }
  }

  await route.register(jwt, {
    secret: keys,
    sign: { algorithm: 'RS256' }
  })

  await route.register(auth)
  route.decorate('verifyAdmin', verifyTokenCapabilities(store, [CAPABILITIES.ADMIN]))
  route.decorate('verifyPublisher', verifyTokenCapabilities(store, [CAPABILITIES.PUBLISHER]))
  route.decorate('verifyRefresh', verifyTokenCapabilities(store, [CAPABILITIES.REFRESH]))
  return await route.after()
}
