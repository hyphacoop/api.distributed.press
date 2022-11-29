import { FastifyInstance } from 'fastify'
import { Site } from './schemas'
import { Type, Static } from '@sinclair/typebox'

export const NewSite = Type.Pick(Site, ['domain', 'publication'])
export const UpdateSite = Type.Pick(Site, ['publication'])

// TODO, use a preValidation hook here to check for JWT, this should
// call into the authorization module
export async function siteRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: Static<typeof NewSite>
    Reply: Static<typeof Site>
  }>('/sites', {
    schema: {
      body: NewSite,
      response: {
        200: Site
      },
      description: "Create a new site"
    }
  }, async (_request, reply) => {
    // TODO: stub
    return await reply.status(200)
  })

  server.get<{
    Params: {
      domain: string
    }
    Reply: Static<typeof Site>
  }>('/sites/:domain', {
    schema: {
      params: {
        domain: Type.String()
      },
      response: {
        200: Site
      }
    }
  }, async (request, _reply) => {
    const { domain } = request.params
    // TODO: stub
    return {
      domain,
      dns: {
        server: '',
        domains: []
      },
      links: {
        http: '',
        hyper: '',
        hyperGateway: '',
        hyperRaw: '',
        ipns: '',
        ipnsRaw: '',
        ipnsGateway: '',
        ipfs: '',
        ipfsGateway: ''
      },
      publication: {
        http: {},
        hyper: {},
        ipfs: {}
      }
    }
  })

  server.post<{
    Params: {
      domain: string
    }
    Body: Static<typeof UpdateSite>
  }>('/sites/:domain', {
    schema: {
      body: UpdateSite,
      params: {
        domain: Type.String()
      }
    }
  }, async (_request, reply) => {
    // TODO: stub
    return await reply.status(200)
  })
}
