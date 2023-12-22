import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { APIConfig, FastifyTypebox } from '../api/index.js'
import { CAPABILITIES, JWTPayload, JWTPayloadT, subset } from './jwt.js'
import { FastifyRequest, FastifyReply } from 'fastify'
import { Value } from '@sinclair/typebox/value'
import { StoreI } from '../config/index.js'
import createError from 'http-errors'

function printCapabilities (capabilities: CAPABILITIES[]): string {
  return capabilities.map(cap => cap.toString()).join(', ')
}

export const verifyTokenCapabilities = async (request: FastifyRequest, store: StoreI, capabilities: CAPABILITIES[]): Promise<void> => {
  if (request.raw.headers.authorization === undefined) {
    throw createError(401, 'Missing token header')
  }
  try {
    const decoded = await request.jwtVerify<JWTPayloadT>()
    if (!Value.Check(JWTPayload, decoded)) {
      throw createError(400, 'Malformed JWT Payload')
    }
    if (!subset(capabilities, decoded.capabilities)) {
      throw createError(403, `Mismatched capabilities: got ${printCapabilities(decoded.capabilities)}, wanted ${printCapabilities(capabilities)}`)
    }
    if (decoded.expires !== -1 && decoded.expires < (new Date()).getTime()) {
      throw createError(401, 'JWT token has expired, please refresh it')
    }
    const isRevoked = await store.revocations.isRevoked(decoded)
    if (isRevoked) {
      throw createError(401, 'JWT token has been revoked')
    } else {
      return await Promise.resolve()
    }
  } catch (error) {
    if (error instanceof createError.HttpError) {
      throw createError(401, `JWT error: ${error.message}`)
    } else {
      throw createError(500, `Internal Server Error: ${error as string}`)
    }
  }
}

const verifyTokenCapabilitiesHandler = (store: StoreI, capabilities: CAPABILITIES[]) => async (request: FastifyRequest, _reply: FastifyReply) => {
  return await verifyTokenCapabilities(request, store, capabilities)
}

export const registerAuth = async (cfg: APIConfig, route: FastifyTypebox, store: StoreI): Promise<void> => {
  const keys = {
    private: readFileSync(path.join(cfg.storage, 'keys', 'private.key'), 'utf8'),
    public: readFileSync(path.join(cfg.storage, 'keys', 'public.key'), 'utf8')
  }

  await route.register(jwt, {
    secret: keys,
    sign: { algorithm: 'RS256' }
  })

  await route.register(auth)
  route.decorate('verifyAdmin', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.ADMIN]))
  route.decorate('verifyPublisher', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.PUBLISHER]))
  route.decorate('verifyRefresh', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.REFRESH]))
  return await route.after()
}
