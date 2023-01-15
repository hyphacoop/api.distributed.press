import { NewAdmin, Admin } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'

export class AdminStore extends Config<Static<typeof Admin>> {
  async create (cfg: Static<typeof NewAdmin>): Promise<string> {
    const id = nanoid()
    return await this.db.put(id, {
      id,
      ...cfg
    }).then(() => id)
  }

  async get (id: string): Promise<Static<typeof Admin>> {
    return await this.db.get(id)
  }

  async delete (id: string): Promise<void> {
    return await this.db.del(id)
  }
}
