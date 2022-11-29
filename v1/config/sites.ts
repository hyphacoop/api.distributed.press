import { NewSite, UpdateSite, Site } from '../api/schemas'
import { Static } from '@sinclair/typebox'

export function createSite (cfg: Static<typeof NewSite>): void {
  console.log(cfg)
}

export function updateSite (domain: string, cfg: Static<typeof UpdateSite>): void {
  console.log(domain, cfg)
}

export function getSite (domain: string): Static<typeof Site> {
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
}

export function deleteSite (id: string): void {
  console.log(id)
}
