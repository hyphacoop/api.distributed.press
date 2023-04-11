import { Static, Type } from '@sinclair/typebox'
import { generateKeyPairSync } from 'crypto'
import { nanoid } from 'nanoid'

export const SYSTEM = 'system'

// CAPABILITIES
export enum CAPABILITIES {
  ADMIN = 'admin',
  PUBLISHER = 'publisher',
  REFRESH = 'refresh',
}
export const CAPABILITIES_ARRAY = Type.Array(Type.Enum(CAPABILITIES))

export const NewJWTPayload = Type.Object({
  issuedTo: Type.Optional(Type.String()),
  capabilities: CAPABILITIES_ARRAY
})

/// returns true if arr1 is a subset of arr2
export function subset (arr1: CAPABILITIES[], arr2: CAPABILITIES[]): boolean {
  return arr1.every(x => arr2.includes(x))
}

// a year
const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000
export function getExpiry (isRefresh: boolean): number {
  return isRefresh ? -1 : (new Date()).getTime() + EXPIRY_MS
}

interface JWTArgs {
  isAdmin: boolean
  isRefresh: boolean
  issuedTo?: string
}

export const JWTPayload = Type.Object({
  tokenId: Type.String(),
  issuedTo: Type.String(),
  expires: Type.Number(),
  capabilities: CAPABILITIES_ARRAY
})

export type JWTPayloadT = Static<typeof JWTPayload>

export function makeJWTToken ({ isAdmin, isRefresh, issuedTo }: JWTArgs): JWTPayloadT {
  const baseCapabilities = [CAPABILITIES.PUBLISHER]
  if (isAdmin) {
    baseCapabilities.push(CAPABILITIES.ADMIN)
  }
  if (isRefresh) {
    baseCapabilities.push(CAPABILITIES.REFRESH)
  }
  return {
    tokenId: nanoid(),
    issuedTo: issuedTo ?? SYSTEM,
    expires: getExpiry(isRefresh),
    capabilities: baseCapabilities
  }
}

export function generateKeyPair (): { privateKey: string, publicKey: string } {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })
}
