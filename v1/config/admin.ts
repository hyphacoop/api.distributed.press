import { NewAdmin, Admin } from '../api/schemas'
import { Static } from '@sinclair/typebox'

export function createAdmin (_cfg: Static<typeof NewAdmin>): string {
  return 'PLACEHOLDER_ID'
}

export function updateAdmin (_cfg: Static<typeof NewAdmin>): string {
  return 'PLACEHOLDER_ID'
}

export function getAdmin (id: string): Static<typeof Admin> {
  return {
    id
  }
}

export function deleteAdmin (id: string): void {
  console.log(id)
}
