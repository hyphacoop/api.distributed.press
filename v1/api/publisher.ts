import { Type, Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import { StoreI } from '../config/index.js'
import { NewPublisher, Publisher } from './schemas.js'

export const publisherRoutes = (store: StoreI) => async (server: FastifyInstance): Promise<void> => {
  server.post<{
    Body: Static<typeof NewPublisher>
    Reply: Static<typeof Publisher>
  }>('/publisher', {
    schema: {
      body: Publisher,
      response: {
        200: Publisher
      },
      description: 'Add a new publisher.',
      tags: ['publisher']
    }
  }, async (request, _reply) => {
    return store.publisher.create(request.body)
  })

  server.get<{
    Params: {
      id: string
    }
    Reply: Static<typeof Publisher>
  }>('/publisher/:id', {
    schema: {
      params: {
        id: Type.String()
      },
      response: {
        200: Publisher
      },
      description: 'Gets information about a specific publisher',
      tags: ['publisher']
    }
  }, async (request, _reply) => {
    const { id } = request.params
    return store.publisher.get(id)
  })

  server.delete<{
    Params: {
      id: string
    }
  }>('/publisher/:id', {
    schema: {
      description: 'Delete a publisher',
      tags: ['publisher']
    }
  }, async (request, _reply) => {
    const { id } = request.params
    return store.publisher.delete(id)
  })
}
