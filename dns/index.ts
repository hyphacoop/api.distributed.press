import dns2 from 'dns2'
import { FastifyBaseLogger } from 'fastify'
import { SiteConfigStore } from '../config/sites.js'

export async function initDnsServer (port: number, store: SiteConfigStore, logger?: FastifyBaseLogger): Promise<ReturnType<typeof dns2.createServer>> {
  const server = dns2.createServer({
    udp: true,
    handle: (request, send, rinfo) => {
      const response = dns2.Packet.createResponseFromRequest(request)
      const [{ name }] = request.questions
      logger?.info(`[dns] ${rinfo.address}:${rinfo.port} asked for ${name}`)

      const cleanedName = name.toLowerCase().replace('_dnslink.', '')
      store.get(cleanedName)
        .then(({ links }) => {
          if (links.ipfs !== undefined) {
            response.answers.push({
              name,
              type: dns2.Packet.TYPE.TXT,
              class: dns2.Packet.CLASS.IN,
              ttl: 60,
              data: `dnslink=${links.ipfs.dnslink}`
            })
          }
          if (links.hyper !== undefined) {
            response.answers.push({
              name,
              type: dns2.Packet.TYPE.TXT,
              class: dns2.Packet.CLASS.IN,
              ttl: 60,
              data: `dnslink=${links.hyper.dnslink}`
            })
          }
          if (links.bittorrent !== undefined) {
            response.answers.push({
              name,
              type: dns2.Packet.TYPE.TXT,
              class: dns2.Packet.CLASS.IN,
              ttl: 60,
              data: `dnslink=${links.bittorrent.dnslink}`
            })
          }
          send(response)
        })
        .catch((error) => {
          logger?.error(`[dns] Error handling request: ${error as string}`)
          send(response)
        })
    }
  })

  // add logging handlers
  server
    .on('requestError', (error) => {
      logger?.error(`[dns] Error handling request: ${error as string}`)
    })
    .on('listening', () => {
      logger?.info(`[dns] Starting DNS server on port ${port}`)
    })
    .on('close', () => {
      logger?.info('[dns] Closing DNS server')
    })

  await server.listen({
    udp: port,
    tcp: port
  })

  return server
}
