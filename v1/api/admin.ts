import { Static, Type } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import { makeAdminToken } from '../authorization/jwt.js'
import { StoreI } from '../config/index.js'
import { NewAdmin } from './schemas.js'

export const adminRoutes = (store: StoreI) => async (server: FastifyInstance): Promise<void> => {
  server.post<{
    Body: Static<typeof NewAdmin>
    Reply: string // id of the admin
  }>('/admin', {
    schema: {
      body: NewAdmin,
      description: 'Add a new admin.',
      tags: ['admin'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    const id = await store.admin.create(request.body)
    return await reply.send(id)
  })

  server.delete<{
    Params: {
      id: string
    }
  }>('/admin/:id', {
    schema: {
      description: 'Delete an admin',
      tags: ['admin'],
      params: {
        id: Type.String()
      },
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    await store.admin.delete(id)
    return await reply.status(200)
  })

  server.post<{
    Params: {
      id: string
    }
    Reply: string // raw string of the JWT token
  }>('/admin/:id/auth/refresh', {
    schema: {
      description: 'Exchange a refresh token for an access token',
      tags: ['admin'],
      params: {
        id: Type.String()
      },
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdminRefresh])
  }, async (request, reply) => {
    const { id } = request.params
    const token = await reply.jwtSign(makeAdminToken(id, false))
    return token
  })
}
