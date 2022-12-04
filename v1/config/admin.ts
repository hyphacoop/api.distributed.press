import { NewAdmin, Admin } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'

export class AdminStore extends Config<Static<typeof Admin>> {
  getKeyPrefix(): string {
    return "ADMIN"
  }

  async create(cfg: Static<typeof NewAdmin>): Promise<string> {
    const id = nanoid();
    await this.db.put(this.wrapWithKeyPrefix(id), {
      id,
      ...cfg
    })
    return id
  }

  async get(id: string): Promise<Static<typeof Admin>> {
    return this.db.get(this.wrapWithKeyPrefix(id))
  }

  async delete(id: string): Promise<void> {
    return this.db.del(this.wrapWithKeyPrefix(id))
  }
}
