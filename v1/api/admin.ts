import { Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import { StoreI } from '../config/index.js'
import { NewAdmin } from './schemas.js'

export const adminRoutes = (store: StoreI) => async (server: FastifyInstance): Promise<void> => {
  server.post<{
    Body: Static<typeof NewAdmin>
    Reply: string
  }>('/admin', {
    schema: {
      body: NewAdmin,
      description: 'Add a new admin.',
      tags: ['admin']
    },
    preHandler: server.auth([server.verifyAdmin]),
  }, async (request, reply) => {
    const id = await store.admin.create(request.body)
    return reply.send(id)
  })

  server.delete<{
    Params: {
      id: string
    }
  }>('/admin/:id', {
    schema: {
      description: 'Delete an admin',
      tags: ['admin']
    },
    preHandler: server.auth([server.verifyAdmin]),
  }, async (request, reply) => {
    const { id } = request.params
    await store.admin.delete(id)
    return reply.status(200)
  })
}
