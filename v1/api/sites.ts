import { FastifyInstance } from "fastify";
import { Site } from "./schemas";
import { Type, Static } from '@sinclair/typebox'

export const NewSite = Type.Pick(Site, ["domain", "publication"])
export const UpdateSite = Type.Pick(Site, ["publication"])

// TODO, use a preValidation hook here to check for JWT, this should
// call into the authorization module
export async function siteRoutes(server: FastifyInstance) {
  server.post<{
    Body: Static<typeof NewSite>,
    Reply: Static<typeof Site>
  }>('/sites', {
    schema: {
      body: NewSite,
      response: {
        200: Site
      },
    },
  }, (request, reply) => {
    // TODO
    // create site and return created site
    reply.status(200)
  })

  server.get<{
    Params: {
      domain: string
    },
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
  }, (request, reply) => {
    // TODO
    const { domain } = request.params;
  })

  server.post<{
    Params: {
      domain: string
    },
    Body: Static<typeof UpdateSite>
  }>('/sites/:domain', {
    schema: {
      body: UpdateSite,
      params: {
        domain: Type.String()
      },
    }
  }, (request, reply) => {
    // TODO
  })


}
