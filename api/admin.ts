import { Static, Type } from '@sinclair/typebox'
import { StoreI } from '../config/index.js'
import { APIConfig, FastifyTypebox } from './index.js'
import { Admin, NewAdmin } from './schemas.js'

export const adminRoutes = (_cfg: APIConfig, store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  server.post<{
    Body: Static<typeof NewAdmin>
    Reply: Static<typeof Admin>
  }>('/admin', {
    schema: {
      body: NewAdmin,
      response: {
        200: Admin
      },
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
    return await reply.send()
  })
}
