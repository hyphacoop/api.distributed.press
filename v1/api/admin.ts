import { Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import config from '../config/index.js'
import { NewAdmin } from './schemas.js'

export async function adminRoutes (server: FastifyInstance): Promise<void> {
  server.post<{
    Body: Static<typeof NewAdmin>
    Reply: string 
  }>('/admin', {
    schema: {
      body: NewAdmin,
      description: 'Add a new admin.',
      tags: ['admin']
    }
  }, async (request, reply) => {
    const id = await config.admin.create(request.body)
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
    }
  }, async (request, reply) => {
    const { id } = request.params
    await config.admin.delete(id)
    return reply.status(200)
  })
}
