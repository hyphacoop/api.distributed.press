import dns2, { Packet } from 'dns2'
import { FastifyBaseLogger } from 'fastify'
import { SiteConfigStore } from '../config/sites.js'

export async function initDnsServer(store: SiteConfigStore, logger: FastifyBaseLogger): Promise<ReturnType<typeof dns2.createServer>> {
  const server = dns2.createServer({
    udp: true,
    handle: async (request, send, rinfo) => {
      const response = Packet.createResponseFromRequest(request)
      const [{ name }] = request.questions
      logger.info(`[dns] ${rinfo.address}:${rinfo.port} asked for ${name}`)

      const trimmedName = name.replace("_dnslink.", "")
      const { links } = await store.get(trimmedName)

      // TODO(support http and hyper)

      if (links.ipfs !== undefined) {
        response.answers.push({
          name,
          type: Packet.TYPE.TXT,
          class: Packet.CLASS.IN,
          ttl: 60,
          data: `dnslink=${links.ipfs.link}`
        })
      }

      send(response)
    }
  })

  // add logging handlers
  server
    .on('requestError', (error) => {
      logger.warn(`[dns] error handling request: ${error}`)
    })
    .on('listening', () => {
      logger.info('[dns] starting DNS server')
    })
    .on('close', () => {
      logger.info('[dns] closing DNS server')
    })

  await server.listen({
    udp: 5333,
    tcp: 5333,
  })

  return server
}
