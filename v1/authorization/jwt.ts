import { Static, Type } from '@sinclair/typebox'

export const SYSTEM = 'system'

// account types
export const ADMIN = 'admin'
export const PUBLISHER = 'publisher'
export const AccountType = Type.Union([Type.Literal(ADMIN), Type.Literal(PUBLISHER)])
export type AccountTypeT = Static<typeof AccountType>

// 1 day
const EXPIRY_MS = 1 * 24 * 60 * 60 * 1000
function getExpiry (isRefresh: boolean): number {
  return isRefresh ? (new Date()).getTime() + EXPIRY_MS : -1
}

// ID of admin that created the token (or system if generated from keygen.ts)
export const Creator = Type.Union([
  Type.Literal(SYSTEM),
  Type.String()
])
export type CreatorT = Static<typeof Creator>

export const JWTPayload = Type.Object({
  createdBy: Creator,
  expires: Type.Number(),
  accountType: AccountType,
  accountId: Type.String()
})

export type JWTPayloadT = Static<typeof JWTPayload>

export function makeAdminToken (id: string, isRefresh: boolean, createdBy?: CreatorT): JWTPayloadT {
  return {
    createdBy: createdBy ?? SYSTEM,
    expires: getExpiry(isRefresh),
    accountType: ADMIN,
    accountId: id
  }
}

export function makePublisherToken (id: string, isRefresh: boolean, createdBy?: CreatorT): JWTPayloadT {
  return {
    createdBy: createdBy ?? SYSTEM,
    expires: getExpiry(isRefresh),
    accountType: PUBLISHER,
    accountId: id
  }
}
