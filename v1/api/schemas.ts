import { TIntersect, TObject, Type } from '@sinclair/typebox'

export const DNS = Type.Object({
  server: Type.String(),
  domains: Type.Array(Type.String())
})

const AbstractProtocol = Type.Object({
  enabled: Type.Boolean(),
  link: Type.String()
})
export const GenericProtocol = <T extends TObject>(type: T): TIntersect<[T, typeof AbstractProtocol]> => Type.Intersect([type, AbstractProtocol])
export const HTTPProtocolFields = GenericProtocol(Type.Object({}))
export const HyperProtocolFields = GenericProtocol(Type.Object({
  gateway: Type.String(),
  raw: Type.String()
}))
export const IPFSProtocolFields = GenericProtocol(Type.Object({
  gateway: Type.String(),
  cid: Type.String(),
  pubKey: Type.String()
}))

export const Protocols = Type.Object({
  http: HTTPProtocolFields,
  hyper: HyperProtocolFields,
  ipfs: IPFSProtocolFields
})
export const ProtocolStatus = Type.Record(Type.KeyOf(Protocols), Type.Boolean())
export const Site = Type.Object({
  id: Type.String(),
  domain: Type.String(),
  protocols: ProtocolStatus,
  links: Type.Partial(Protocols)
})
export const NewSite = Type.Omit(Site, ['id', 'links'])

export const Publisher = Type.Object({
  id: Type.String(),
  name: Type.String(),
  ownedSites: Type.Array(Type.String()) // array of IDs of sites
})
export const NewPublisher = Type.Omit(Publisher, ['id', 'ownedSites'])

export const Admin = Type.Object({
  id: Type.String(),
  name: Type.String()
})
export const NewAdmin = Type.Omit(Admin, ['id'])
