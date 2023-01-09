import { Type, Static } from '@sinclair/typebox'
import { CAPABILITIES_ARRAY, CAPABILITIES, getExpiry, subset } from '../authorization/jwt.js'
import { StoreI } from '../config/index.js'
import { FastifyTypebox } from './index.js'

export const authRoutes = (store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  server.post<{
    Body: Static<typeof CAPABILITIES_ARRAY>
  }>('/auth/exchange', {
    schema: {
      body: CAPABILITIES_ARRAY,
      response: {
        200: Type.String(),
        401: Type.String()
      },
      description: 'Exchange an old token for a new one with a subset of initial capabilities and an updated expiry time. Takes in the old token from the Authorization header',
      tags: ['admin', 'publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyRefresh])
  }, async (request, reply) => {
    const token = request.user
    if (!subset(request.body, token.capabilities)) {
      return await reply.status(401).send('Requested more permissions than original token has')
    }
    if (!token.capabilities.includes(CAPABILITIES.ADMIN) && request.body.includes(CAPABILITIES.REFRESH)) {
      return await reply.status(401).send("Can't create new refresh tokens if you are not an admin. Please contact an administrator")
    }
    const newToken = {
      ...token,
      expires: getExpiry(false)
    }
    const signed = await reply.jwtSign(newToken)
    return await reply.status(200).send(signed)
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
