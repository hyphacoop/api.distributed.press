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
  ipfsGateway: Type.String(),
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
    http: Type.Optional(Publication),
    hyper: Type.Optional(Publication),
    ipfs: Type.Optional(Publication),
  }),
})

