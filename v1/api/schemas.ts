import { Type } from '@sinclair/typebox'

export const DNS = Type.Object({
  server: Type.String(),
  domains: Type.Array(Type.String())
})

export const Links = Type.Object({
  http: Type.String(),
  hyper: Type.String(),
  hyperGateway: Type.String(),
  hyperRaw: Type.String(),
  ipns: Type.String(),
  ipnsRaw: Type.String(),
  ipnsGateway: Type.String(),
  ipfs: Type.String(),
  ipfsGateway: Type.String()
})

export const Publication = Type.Object({
  enabled: Type.Boolean(),
  pinningURL: Type.Optional(Type.String())
})

export const Site = Type.Object({
  domain: Type.String(),
  dns: DNS,
  links: Links,
  publication: Type.Object({
    http: Type.Partial(Publication),
    hyper: Type.Partial(Publication),
    ipfs: Type.Partial(Publication)
  })
})
export const NewSite = Type.Pick(Site, ['publication'])
export const UpdateSite = Type.Pick(Site, ['domain'])

export const Publisher = Type.Object({
  id: Type.String()
  // TODO: what other fields do we need here?
})
export const NewPublisher = Type.Pick(Publisher, ['id'])

export const Admin = Type.Object({
  id: Type.String()
  // TODO: what other fields do we need here?
})
export const NewAdmin = Type.Pick(Admin, ['id'])
