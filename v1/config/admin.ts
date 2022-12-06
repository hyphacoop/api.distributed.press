import { NewAdmin, Admin } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'

export class AdminStore extends Config {
  async create(cfg: Static<typeof NewAdmin>): Promise<string> {
    const id = nanoid();
    return this.db.put(id, {
      id,
      ...cfg
    }).then(() => id)
  }

  async get(id: string): Promise<Static<typeof Admin>> {
    return this.db.get(id)
  }

  async delete(id: string): Promise<void> {
    return this.db.del(id)
  }
}
