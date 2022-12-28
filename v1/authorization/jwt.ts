import { Static, Type } from '@sinclair/typebox'
import { nanoid } from 'nanoid'

export const SYSTEM = 'system'

// CAPABILITIES
export enum CAPABILITIES {
  ADMIN = 'admin',
  PUBLISHER = 'publisher',
  REFRESH = 'refresh',
}
export const CAPABILITIES_ARRAY = Type.Array(Type.Enum(CAPABILITIES))

/// returns true if arr1 is a subset of arr2
export function subset(arr1: CAPABILITIES[], arr2: CAPABILITIES[]): boolean {
  return arr1.every(x => arr2.includes(x))
}

// 1 day
const EXPIRY_MS = 1 * 24 * 60 * 60 * 1000
export function getExpiry (isRefresh: boolean): number {
  return isRefresh ? -1 : (new Date()).getTime() + EXPIRY_MS
}

export const JWTPayload = Type.Object({
  id: Type.String(),
  expires: Type.Number(),
  capabilities: CAPABILITIES_ARRAY 
})

export type JWTPayloadT = Static<typeof JWTPayload>

export function makeJWTToken ({ isAdmin, isRefresh }: { isAdmin: boolean, isRefresh: boolean }): JWTPayloadT {
  const baseCapabilities = [CAPABILITIES.PUBLISHER]
  if (isAdmin) {
    baseCapabilities.push(CAPABILITIES.ADMIN)
  }
  if (isRefresh) {
    baseCapabilities.push(CAPABILITIES.REFRESH)
  }
  return {
    id: nanoid(),
    expires: getExpiry(isRefresh),
    capabilities: baseCapabilities
  }
}
