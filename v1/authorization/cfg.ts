import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { FastifyTypebox } from '../api/index.js'
import { AccountTypeT, ADMIN, JWTPayload, JWTPayloadT, PUBLISHER } from './jwt.js'
import { FastifyRequest, FastifyReply, DoneFuncWithErrOrRes } from 'fastify'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Value } from '@sinclair/typebox/value/index.js'

const paths = envPaths('distributed-press')
const argv = yargs(hideBin(process.argv)).options({
  data: { type: 'string' }
}).parseSync()
const dataPath = argv.data ?? paths.data

const verifyAccessToken = (accountType: AccountTypeT) => (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (request.raw.headers.authorization === undefined) {
    return done(new Error('Missing token header'))
  }
  request.jwtVerify<JWTPayloadT>().then((decoded) => {
    if (!Value.Check(JWTPayload, decoded)) {
      return done(new Error('Malformed JWT Payload'))
    }
    if (decoded.accountType !== accountType) {
      return done(new Error(`Mismatched account type: got ${decoded.accountType}, wanted ${accountType}`))
    }
    if (decoded.expires === -1) {
      return done(new Error('Received a refresh token; expected an access token'))
    }
    if (decoded.expires < (new Date()).getTime()) {
      return done(new Error('JWT token has expired. Please get a new one using a refresh token'))
    }
    return done()
  }).catch((err) => done(new Error(`Cannot verify access token JWT: ${err}`)))
}

const verifyRefreshToken = (accountType: AccountTypeT) => (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (request.raw.headers.authorization === undefined) {
    return done(new Error('Missing token header'))
  }
  request.jwtVerify<JWTPayloadT>().then((decoded) => {
    if (!Value.Check(JWTPayload, decoded)) {
      return done(new Error('Malformed JWT Payload'))
    }
    if (decoded.accountType !== accountType) {
      return done(new Error(`Mismatched account type: got ${decoded.accountType}, wanted ${accountType}`))
    }
    if (decoded.expires !== -1) {
      return done(new Error('Received an access token; expected a refresh token'))
    }
    return done()
  }).catch((err) => done(new Error(`Cannot verify refresh token JWT: ${err}`)))
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
  route.decorate('verifyAdmin', verifyAccessToken(ADMIN))
  route.decorate('verifyPublisher', verifyAccessToken(PUBLISHER))
  route.decorate('verifyAdminRefresh', verifyRefreshToken(ADMIN))
  route.decorate('verifyPublisherRefresh', verifyRefreshToken(PUBLISHER))
  return route.after()
}
