import { Type, Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import { makePublisherToken } from '../authorization/jwt.js'
import { StoreI } from '../config/index.js'
import { NewPublisher, Publisher } from './schemas.js'

export const publisherRoutes = (store: StoreI) => async (server: FastifyInstance): Promise<void> => {
  server.post<{
    Body: Static<typeof NewPublisher>
    Reply: Static<typeof Publisher>
  }>('/publisher', {
    schema: {
      body: NewPublisher,
      response: {
        200: Publisher
      },
      description: 'Add a new publisher.',
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    return reply.send(await store.publisher.create(request.body))
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
  }, async (request, reply) => {
    const { id } = request.params
    return reply.send(await store.publisher.get(id))
  })

  server.get<{
    Params: {
      id: string
    }
    Reply: string
  }>('/publisher/:id/auth', {
    schema: {
      params: {
        id: Type.String()
      },
      description: 'Retrieves refresh token for specified publisher. Admin gated',
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    const token = await reply.jwtSign(makePublisherToken(id, true))
    return reply.send(token)
  })

  server.post<{
    Params: {
      id: string
    }
  }>('/publisher/:id/auth/refresh', {
    schema: {
      description: 'Exchange a refresh token for an access token',
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisherRefresh])
  }, async (request, reply) => {
    const { id } = request.params
    const token = await reply.jwtSign(makePublisherToken(id, false))
    return reply.send(token)
  })

  server.delete<{
    Params: {
      id: string
    }
  }>('/publisher/:id', {
    schema: {
      description: 'Delete a publisher',
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    await store.publisher.delete(id)
    return reply.code(200).send()
  })
}
