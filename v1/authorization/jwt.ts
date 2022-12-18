import { Static, Type } from '@sinclair/typebox'
import { nanoid } from 'nanoid'
import { Admin, Publisher } from '../api/schemas.js'

export const SYSTEM = 'system'

// account types
export const ADMIN = 'admin'
export const PUBLISHER = 'publisher'

// 1 day
const EXPIRY_MS = 1 * 24 * 60 * 60 * 1000
function getExpiry(isRefresh: boolean): number {
  return isRefresh ? (new Date()).getTime() + EXPIRY_MS : -1
}

// ID of admin that created the token (or system if generated from keygen.ts)
export const Creator = Type.Union([
  Type.Literal(SYSTEM),
  Type.String()
]);
export type CreatorT = Static<typeof Creator>

export const BaseToken = Type.Object({
  createdBy: Creator,
  expires: Type.Number()
})

export const AdminToken = Type.Object({
  type: Type.Literal(ADMIN),
  details: Admin
})

export const PublisherToken = Type.Object({
  type: Type.Literal(PUBLISHER),
  details: Publisher
})

export const JWTPayload = Type.Intersect([
  BaseToken,
  Type.Object({
    account: Type.Union([AdminToken, PublisherToken])
  }),
])

export type JWTPayloadT = Static<typeof JWTPayload>;

export function makeAdmin(name: string, isRefresh: boolean, createdBy?: CreatorT): JWTPayloadT {
  return {
    createdBy: createdBy ?? 'system',
    expires: getExpiry(isRefresh),
    account: {
      type: 'admin',
      details: {
        id: nanoid(),
        name
      }
    }
  }
}

export function makePublisher(name: string, isRefresh: boolean, createdBy?: CreatorT): JWTPayloadT {
  return {
    createdBy: createdBy ?? 'system',
    expires: getExpiry(isRefresh),
    account: {
      type: 'publisher',
      details: {
        id: nanoid(),
        name
      }
    }
  }
}
