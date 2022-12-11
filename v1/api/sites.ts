import { FastifyInstance } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { NewSite, Site, UpdateSite } from './schemas.js'
import { StoreI } from '../config/index.js'

// TODO, use a preValidation hook here to check for JWT, this should
// call into the authorization module
export const siteRoutes = (store: StoreI) => async (server: FastifyInstance): Promise<void> => {
  server.post<{
    Body: Static<typeof NewSite>
    Reply: Static<typeof Site>
  }>('/sites', {
    schema: {
      body: NewSite,
      response: {
        200: Site
      },
      description: 'Create a new site.',
      tags: ['site']
    },
    preHandler: server.auth([server.verifyPublisher]),
  }, async (request, _reply) => {
    return store.sites.create(request.body)
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
      },
      description: 'Returns the configuration and info about the domain.',
      tags: ['site']
    }
  }, async (request, _reply) => {
    const { domain } = request.params
    return store.sites.get(domain)
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
      },
      description: 'Update the configuration for the site.',
      tags: ['site'],
      security: [{ "jwt": [] }]
    },
    preHandler: server.auth([server.verifyPublisher]),
  }, async (request, _reply) => {
    const { domain } = request.params
    return store.sites.update(domain, request.body)
  })

  server.put<{
    Params: { domain: string }
    Body: Static<typeof UpdateSite>
  }>('/sites/:domain', {
    schema: {
      body: NewSite,
      params: {
        domain: Type.String()
      },
      description: 'Upload content to the site. Body must be a `tar.gz` file which will get extracted out and served. Any files missing from the tarball that are on disk, will be deleted from disk and the p2p archives.',
      tags: ['site'],
      security: [{ "jwt": [] }]
    },
    preHandler: server.auth([server.verifyPublisher]),
  }, async (request, reply) => {
    // TODO: stub
    // handle errors
    // - ensure only one file
    // - ensure its a tarball
    // - ensure size in range
    // do something with files
    const { domain } = request.params
    const files = await request.saveRequestFiles()
    request.log.info(`${domain} ${files.length}`)
    return await reply.status(200)
  })

  server.patch<{
    Params: { domain: string }
  }>('/sites/:domain', {
    schema: {
      params: {
        domain: Type.String()
      },
      description: 'Upload a patch with just the files you want added. This will only do a diff on the files in the tarball and will not delete any missing files.',
      tags: ['site'],
      security: [{ "jwt": [] }]
    },
    preHandler: server.auth([server.verifyPublisher]),
  }, async (request, reply) => {
    // TODO: stub
    // handle errors
    // - ensure only one file
    // - ensure its a tarball
    // - ensure size in range
    // do something with files
    const { domain } = request.params
    const files = await request.saveRequestFiles()
    request.log.info(`${domain}, ${files.length}`)
    return await reply.status(200)
  })
}
