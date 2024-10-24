import { Type, Static } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'
import { StoreI } from '../config/index.js'
import { APIConfig } from './index.js'
import { NewPublisher, Publisher } from './schemas.js'
import { makeJWTToken } from '../authorization/jwt.js'

export const publisherRoutes = (_cfg: APIConfig, store: StoreI) => async (server: FastifyInstance): Promise<void> => {
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

  server.post<{
    Body: Static<typeof NewPublisher>
  }>('/publisher/trial', {
    schema: {
      body: NewPublisher,
      response: {
        200: Type.String()
      },
      description: 'Register yourself as a new publisher',
      tags: ['publisher'],
      security: []
    }
  }, async (request, reply) => {
    const account = await store.publisher.createTrial(request.body)
    const newToken = makeJWTToken({
      issuedTo: account.id,
      isTrial: true
    })
    const signed = await reply.jwtSign(newToken)

    return reply.send(signed)
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
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin, server.verifyPublisher])
  }, async (request, reply) => {
    const { id } = request.params
    return reply.send(await store.publisher.get(id))
  })

  server.get<{ Reply: string[] }>('/publisher', {
    schema: {
      description: 'Returns a list of all publishers on the instance',
      tags: ['publisher'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyAdmin])
  }, async (_request, reply) => {
    return reply.send(await store.publisher.keys())
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
