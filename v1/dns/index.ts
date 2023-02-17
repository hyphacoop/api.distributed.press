import dns2 from 'dns2'
import { FastifyBaseLogger } from 'fastify'
import { SiteConfigStore } from '../config/sites.js'

function protocolToMultiformat(link: string): string {
  const [protocol, path] = link.split("://")
  return `/${protocol}/${path}`
}

export async function initDnsServer(port: number, store: SiteConfigStore, logger: FastifyBaseLogger): Promise<ReturnType<typeof dns2.createServer>> {
  const server = dns2.createServer({
    udp: true,
    handle: (request, send, rinfo) => {
      const response = dns2.Packet.createResponseFromRequest(request)
      const [{ name }] = request.questions
      logger.info(`[dns] ${rinfo.address}:${rinfo.port} asked for ${name}`)

      const trimmedName = name.replace('_dnslink.', '')
      store.get(trimmedName)
        .then(({ links }) => {
          if (links.ipfs !== undefined) {
            response.answers.push({
              name,
              type: dns2.Packet.TYPE.TXT,
              class: dns2.Packet.CLASS.IN,
              ttl: 60,
              data: `dnslink=${protocolToMultiformat(links.ipfs.pubKey)}`
            })
          }
          if (links.hyper !== undefined) {
            response.answers.push({
              name,
              type: dns2.Packet.TYPE.TXT,
              class: dns2.Packet.CLASS.IN,
              ttl: 60,
              data: `dnslink=${protocolToMultiformat(links.hyper.raw)}`
            })
          }
          send(response)
        })
        .catch((error) => logger.error(`[dns] error handling request: ${error as string}`))
    }
  })

  // add logging handlers
  server
    .on('requestError', (error) => {
      logger.error(`[dns] error handling request: ${error as string}`)
    })
    .on('listening', () => {
      logger.info(`[dns] starting DNS server on port ${port}`)
    })
    .on('close', () => {
      logger.info('[dns] closing DNS server')
    })

  await server.listen({
    udp: port,
    tcp: port
  })

  return server
}
