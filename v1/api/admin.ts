import { Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import config from '../config/index.js'
import { NewAdmin } from './schemas.js'

export async function adminRoutes (server: FastifyInstance): Promise<void> {
  server.post<{
    Body: Static<typeof NewAdmin>
  }>('/admin', {
    schema: {
      body: NewAdmin,
      description: 'Add a new admin.',
      tags: ['admin']
    }
  }, async (request, reply) => {
    // TODO: stub
    config.admin.create(request.body)
    return await reply.status(200)
  })

  server.delete<{
    Params: {
      id: string
    }
  }>('/admin/:id', {
    schema: {
      description: 'Delete an admin',
      tags: ['admin']
    }
  }, async (request, reply) => {
    // TODO: stub
    const { id } = request.params
    config.admin.delete(id)
    return await reply.status(200)
  })
}
