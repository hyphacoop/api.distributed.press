import { Type, Static } from '@sinclair/typebox'
import { getExpiry, subset, NewJWTPayload } from '../authorization/jwt.js'
import { StoreI } from '../config/index.js'
import { FastifyTypebox } from './index.js'

export const authRoutes = (store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  server.post<{
    Body: Static<typeof NewJWTPayload>
  }>('/auth/exchange', {
    schema: {
      body: NewJWTPayload,
      response: {
        200: Type.String(),
        401: Type.String()
      },
      description: 'Exchange an old token for a new one with a subset of initial capabilities and an updated expiry time. Takes in the old token from the Authorization header',
      tags: ['admin', 'publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyRefresh, server.verifyAdmin])
  }, async (request, reply) => {
    const token = request.user
    if (!subset(request.body.capabilities, token.capabilities)) {
      return await reply.status(401).send('Requested more permissions than original token has')
    }
    const newToken = {
      ...token,
      issuedTo: request.body.issuedTo ?? token.issuedTo,
      capabilities: request.body.capabilities,
      expires: getExpiry(false)
    }
    const signed = await reply.jwtSign(newToken)
    return await reply.status(200).send(signed)
  })

  server.delete<{
    Params: {
      tokenId: string
    }
  }>('/auth/revoke/:tokenId', {
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
    const { tokenId } = request.params
    await store.revocations.revoke(tokenId)
    return await reply.code(200).send()
  })
}
