import { Type } from '@sinclair/typebox'

export const DNS = Type.Object({
  server: Type.String(),
  domains: Type.Array(Type.String())
})

export const Links = Type.Partial(Type.Object({
  http: Type.String(),
  hyper: Type.String(),
  hyperGateway: Type.String(),
  hyperRaw: Type.String(),
  ipns: Type.String(),
  ipnsRaw: Type.String(),
  ipnsGateway: Type.String(),
  ipfs: Type.String(),
  ipfsGateway: Type.String()
}))

export const Publication = Type.Object({
  enabled: Type.Boolean(),
  pinningURL: Type.Optional(Type.String())
})

export const Site = Type.Object({
  id: Type.String(),
  domain: Type.String(),
  dns: DNS,
  links: Links,
  publication: Type.Object({
    http: Type.Partial(Publication),
    hyper: Type.Partial(Publication),
    ipfs: Type.Partial(Publication)
  })
})
export const NewSite = Type.Omit(Site, ['dns', 'links', 'id'])
export const UpdateSite = Type.Partial(Type.Omit(Site, ['id']))

export const Publisher = Type.Object({
  id: Type.String(),
  name: Type.String()
})
export const NewPublisher = Type.Omit(Publisher, ['id'])

export const Admin = Type.Object({
  id: Type.String(),
  name: Type.String()
})
export const NewAdmin = Type.Omit(Admin, ['id'])
