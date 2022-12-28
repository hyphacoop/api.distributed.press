import { NewPublisher, Publisher } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'

export class PublisherStore extends Config {
  async create(cfg: Static<typeof NewPublisher>): Promise<Static<typeof Publisher>> {
    const id = nanoid()
    const obj = {
      id,
      ...cfg
    }
    return this.db.put(id, obj).then(() => obj)
  }

  async get(id: string): Promise<Static<typeof Publisher>> {
    return this.db.get(id)
  }

  async delete(id: string): Promise<void> {
    return this.db.del(id)
  }
}
