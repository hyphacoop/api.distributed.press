import { TIntersect, TObject, Type } from '@sinclair/typebox'

export const DNS = Type.Object({
  server: Type.String(),
  domains: Type.Array(Type.String())
})

const AbstractProtocol = Type.Object({
  enabled: Type.Boolean(),
  link: Type.String() // raw protocol specific link to the actual site
})
export const GenericProtocol = <T extends TObject>(type: T): TIntersect<[T, typeof AbstractProtocol]> => Type.Intersect([type, AbstractProtocol])
export const HTTPProtocolFields = GenericProtocol(Type.Object({}))
export const HyperProtocolFields = GenericProtocol(Type.Object({
  gateway: Type.String(), // gateway url to enable browsers to access the site (currently hardcoded to use hypha's gateway)
  raw: Type.String(), // raw hyperdrive url
  dnslink: Type.String()
}))
export const IPFSProtocolFields = GenericProtocol(Type.Object({
  gateway: Type.String(), // same as gateway in HyperProtocolFields
  cid: Type.String(), // content id of the root of site
  pubKey: Type.String(), // ipns://{publishKey}
  dnslink: Type.String()
}))
export const BitTorrentProtocolFields = GenericProtocol(Type.Object({
  gateway: Type.String(), // same as gateway in HyperProtocolFields
  magnet: Type.String(), // Used by most torrent clients. Note: Will not update in regular clients
  infoHash: Type.String(), // Immutable link, similar to ipfs public key
  pubKey: Type.String(), // Link to public key for BEP-46, similar to IPNS
  dnslink: Type.String()
}))

export const Protocols = Type.Object({
  http: HTTPProtocolFields,
  hyper: HyperProtocolFields,
  ipfs: IPFSProtocolFields,
  bt: BitTorrentProtocolFields
})
export const ProtocolStatus = Type.Record(Type.KeyOf(Protocols), Type.Boolean())
export const Site = Type.Object({
  id: Type.String(),
  domain: Type.String(),
  protocols: ProtocolStatus,
  links: Type.Partial(Protocols),
  public: Type.Boolean()
})
export const NewSite = Type.Omit(Site, ['id', 'links'])
export const UpdateSite = Type.Partial(Type.Object({
  protocols: ProtocolStatus,
  public: Type.Boolean()
}))

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
