import { Type, Static } from '@sinclair/typebox'
import { NewSite, Site, UpdateSite, SiteStats } from './schemas.js'
import { StoreI } from '../config/index.js'
import { APIConfig, FastifyTypebox } from './index.js'
import { FastifyReply, FastifyRequest } from 'fastify'
import { CAPABILITIES, JWTPayloadT } from '../authorization/jwt.js'
import { verifyTokenCapabilities } from '../authorization/cfg.js'

export const siteRoutes = (cfg: APIConfig, store: StoreI) => async (server: FastifyTypebox): Promise<void> => {
  async function processRequestFiles (request: FastifyRequest, reply: FastifyReply, fn: (filePath: string) => Promise<void>): Promise<void> {
    try {
      request.log.info('Downloading tarfile for site')
      const files = await request.saveRequestFiles({
        limits: {
          files: 1,
          fileSize: 5e9 // 5GB limit (see discussion: https://github.com/hyphacoop/api.distributed.press/pull/34#discussion_r1066556612),
        }
      })
      const tarballPath = files[0].filepath
      request.log.info(`Processing tarball: ${tarballPath}`)
      await fn(tarballPath)
      return await reply.code(200).send()
    } catch (error) {
      if (error instanceof server.multipartErrors.RequestFileTooLargeError) {
        return await reply.code(400).send('tarball too large (limit 5GB)')
      }
      if (error instanceof Error) {
        return await reply.code(500).send(error.stack)
      }
      return await reply.code(500).send()
    }
  }

  async function checkOwnsSite (token: JWTPayloadT, siteId: string): Promise<boolean> {
    const isAdmin = token.capabilities.includes(CAPABILITIES.ADMIN)
    const isOwnerOfSite = !isAdmin && (await store.publisher.get(token.issuedTo)).ownedSites.includes(siteId)
    return isAdmin || isOwnerOfSite
  }

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
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const token = request.user
    const site = await store.sites.create(request.body)

    // Only register site to its owner if they are not an admin
    // Publishers need to track sites they own to ensure they can only modify/delete sites they own
    // This does *not* apply to admins as they effectively have 'wildcard' access to all sites
    if (!request.user.capabilities.includes(CAPABILITIES.ADMIN)) {
      await store.publisher.registerSiteToPublisher(token.issuedTo, site.id)
    }

    await store.fs.makeFolder(site.id)
    return await reply.send(site)
  })

  server.post<{
    Params: {
      id: string
    }
    Reply: Static<typeof Site>
  }>('/sites/:id/clone', {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Site
      },
      description: 'Clone a website from its HTTPs version',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    await store.sites.get(id)
    const path = store.fs.getPath(id)

    await store.sites.clone(id, path)
  })

  server.get<{
    Params: {
      id: string
    }
    Reply: Static<typeof Site>
  }>('/sites/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Site
      },
      description: 'Returns the configuration and info about the domain.',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    return await reply.send(await store.sites.get(id))
  })

  server.get<{
    Params: {
      id: string
    }
    Reply: Static<typeof SiteStats> | string
  }>('/sites/:id/stats', {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: SiteStats
      },
      description: 'Returns the stats for a site',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    // Logging the request initiation
    request.log.info(`Fetching stats for site ID: ${id}`)
    const stats = await store.sites.stats(id)
    // Logging the successful retrieval of stats
    return await reply.send(stats)
  })

  if (cfg.useWebringDirectoryListing === true) {
    server.get<{
      Reply: Array<Static<typeof Site>>
    }>('/sites', {
      schema: {
        description: 'Returns a list of all sites on the instance',
        tags: ['site'],
        security: [{ jwt: [] }]
      }
    }, async (request, reply) => {
      try {
        // admin case, safe to list all
        await verifyTokenCapabilities(request, store, [CAPABILITIES.ADMIN])
        return await reply.send(await store.sites.listAll(false))
      } catch {
        // no token
        return await reply.send(await store.sites.listAll(true))
      }
    })
  }

  server.delete<{
    Params: {
      id: string
    }
  }>('/sites/:id', {
    schema: {
      params: Type.Object({
        id: Type.String()
      }),
      description: 'Deletes a site',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    const token = request.user
    if (!await checkOwnsSite(token, id)) {
      return await reply.status(401).send('You must either own the site or be an admin to modify this resource')
    }

    await store.sites.delete(id, { logger: request.log })
    await store.publisher.unregisterSiteFromAllPublishers(id)
    await store.fs.clear(id)
    return await reply.send()
  })

  server.post<{
    Params: {
      id: string
    }
    Body: Static<typeof UpdateSite>
  }>('/sites/:id', {
    schema: {
      body: UpdateSite,
      params: {
        id: Type.String()
      },
      description: 'Update the configuration for the site.',
      tags: ['site'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    const token = request.user
    if (!await checkOwnsSite(token, id)) {
      return await reply.status(401).send('You must either own the site or be an admin to modify this resource')
    }

    // update config entry
    await store.sites.update(id, request.body)

    // sync files with protocols
    const path = store.fs.getPath(id)
    await store.sites.sync(id, path, { logger: request.log })
    return await reply.code(200).send()
  })

  server.put<{
    Params: { id: string }
  }>('/sites/:id', {
    schema: {
      params: {
        id: Type.String()
      },
      description: 'Upload content to the site. Body must be a `tar.gz` file which will get extracted out and served. Any files missing from the tarball that are on disk, will be deleted from disk and the p2p archives.',
      tags: ['site'],
      consumes: ['multipart/form-data'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher, server.verifyAdmin])
  }, async (request, reply) => {
    const { id } = request.params
    const token = request.user
    if (!await checkOwnsSite(token, id)) {
      return await reply.status(401).send('You must either own the site or be an admin to modify this resource')
    }
    return await processRequestFiles(request, reply, async (tarballPath) => {
      request.log.info('Deleting old files')
      await store.fs.clear(id)

      request.log.info('Extracting tarball')
      await store.fs.extract(tarballPath, id)

      const path = store.fs.getPath(id)
      request.log.info('Performing sync with site')
      await store.sites.sync(id, path, { logger: request.log })

      request.log.info('Finished sync')
    })
  })

  server.patch<{
    Params: { id: string }
  }>('/sites/:id', {
    schema: {
      params: {
        id: Type.String()
      },
      description: 'Upload a patch with just the files you want added. This will only do a diff on the files in the tarball and will not delete any missing files.',
      tags: ['site'],
      consumes: ['multipart/form-data'],
      security: [{ jwt: [] }]
    },
    preHandler: server.auth([server.verifyPublisher])
  }, async (request, reply) => {
    const { id } = request.params
    const token = request.user
    if (!await checkOwnsSite(token, id)) {
      return await reply.status(401).send('You must either own the site or be an admin to modify this resource')
    }
    return await processRequestFiles(request, reply, async (tarballPath) => {
      // extract in place to existing directory
      await store.fs.extract(tarballPath, id)

      // sync to protocols
      const path = store.fs.getPath(id)
      await store.sites.sync(id, path, { logger: request.log })
    })
  })
}
