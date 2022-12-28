import { Type } from '@sinclair/typebox'
import { getExpiry, JWTPayload, JWTPayloadT } from '../authorization/jwt.js'
import { StoreI } from '../config/index.js'
import { FastifyTypebox } from './index.js'

export const authRoutes = (store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  server.post<{
    Reply: JWTPayloadT
  }>('/auth', {
    schema: {
      response: {
        200: JWTPayload
      },
      description: 'Exchange an old refresh token for a new one with an updated expiry time',
      tags: ['admin', 'publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyRefresh])
  }, async (request, reply) => {
    const token = request.user
    const newToken = {
      ...token,
      expires: getExpiry(true)
    }
    return await reply.status(200).send(newToken)
  })

  server.delete<{
    Params: {
      hash: string
    }
  }>('/auth/revoke/:hash', {
    schema: {
      description: 'Revoke a JWT with the corresponding hash',
      tags: ['admin'],
      params: {
        id: Type.String()
      },
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    const { hash } = request.params
    await store.revocations.revoke(hash)
    return await reply.code(200).send()
  })
}
