import test from 'ava'
import DNS from 'dns2'
import getPort from 'get-port'
import { SiteConfigStore } from '../config/sites.js'
import { newSiteConfigStore } from '../fixtures/siteConfig.js'
import { initDnsServer } from './index.js'

async function mockDnsServer (): Promise<[SiteConfigStore, ReturnType<typeof DNS.createServer>]> {
  const port = await getPort()
  const store = newSiteConfigStore()
  const dnsServer = await initDnsServer(port, store)
  return [store, dnsServer]
}

function makeDnsClient (port: number): DNS {
  return new DNS({
    nameServers: ['127.0.0.1'],
    port,
    retries: 0,
    recursive: false
  })
}

function hasAnswer (resp: DNS.DnsResponse, protocol: string): boolean {
  return resp.answers.filter(ans => ans.data?.includes(`/${protocol}/`)).length > 0
}

test('basic dns resolve', async t => {
  const [store, dnsServer] = await mockDnsServer()
  const site = await store.create({
    domain: 'example.com',
    protocols: {
      http: false,
      ipfs: true,
      hyper: true
    },
    public: true
  })
  await store.sync(site.id, 'mockPath')
  const port = dnsServer.addresses().udp?.port as number
  const dnsClient = makeDnsClient(port)
  const response = await dnsClient.query(`_dnslink.${site.domain}`, 'TXT')
  t.true(hasAnswer(response, 'ipns'), 'returned dns query has an ipns entry')
  t.true(hasAnswer(response, 'hyper'), 'returned dns query has a hyper entry')
  t.is(response.answers.filter(ans => ans.type !== DNS.Packet.TYPE.TXT && ans.type !== DNS.Packet.TYPE.NS).length, 0, 'should not include any non-TXT and non-NS entries')
})

test('dns should not resolve unknown domains', async t => {
  const dnsServer = (await mockDnsServer())[1]
  const port = dnsServer.addresses().udp?.port as number
  const dnsClient = makeDnsClient(port)
  const response = await dnsClient.query('_dnslink.unknown.com', 'TXT')
  t.is(response.answers.filter(ans => ans.type === DNS.Packet.TYPE.TXT).length, 0, 'should not have any TXT answers for unknown domains')
})
