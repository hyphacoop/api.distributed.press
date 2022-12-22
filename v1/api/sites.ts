import { Type, Static } from '@sinclair/typebox'
import { NewSite, Site, UpdateSite } from './schemas.js'
import { StoreI } from '../config/index.js'
import { FastifyTypebox } from './index.js'

export const siteRoutes = (store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
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
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    return reply.send(await store.sites.create(request.body))
  })

  server.get<{
    Params: {
      domain: string
    }
    Reply: Static<typeof Site>
  }>('/sites/:domain', {
    schema: {
      params: Type.Object({
        domain: Type.String()
      }),
      response: {
        200: Site
      },
      description: 'Returns the configuration and info about the domain.',
      tags: ['site']
    }
  }, async (request, reply) => {
    const { domain } = request.params
    return reply.send(await store.sites.get(domain))
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
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { domain } = request.params
    await store.sites.update(domain, request.body)
    return reply.code(200).send()
  })

  server.put<{
    Params: { domain: string }
    Body: Static<typeof UpdateSite>
  }>('/sites/:domain', {
    schema: {
      params: {
        domain: Type.String()
      },
      description: 'Upload content to the site. Body must be a `tar.gz` file which will get extracted out and served. Any files missing from the tarball that are on disk, will be deleted from disk and the p2p archives.',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
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
    return reply.code(200).send()
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
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher])
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
    return reply.code(200).send()
  })
}
