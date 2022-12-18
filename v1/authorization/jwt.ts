import { Static } from '@sinclair/typebox'
import { nanoid } from 'nanoid'
import { Admin, Publisher } from '../api/schemas.js'

export type SYSTEM = 'system'

// account types
export type ADMIN = 'admin'
export type PUBLISHER = 'publisher'

export type Creator = SYSTEM | string
export type JWTPayload = {
  createdBy: Creator
} & ({
  accountType: 'admin'
  account: Static<typeof Admin>
} | {
  accountType: 'publisher'
  account: Static<typeof Publisher>
})

export function makeAdmin (name: string, createdBy?: Creator): JWTPayload {
  return {
    createdBy: createdBy ?? 'system',
    accountType: 'admin',
    account: {
      id: nanoid(),
      name
    }
  }
}

export function makePublisher (name: string, createdBy?: Creator): JWTPayload {
  return {
    createdBy: createdBy ?? 'system',
    accountType: 'publisher',
    account: {
      id: nanoid(),
      name
    }
  }
}
