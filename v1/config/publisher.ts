import { NewPublisher, Publisher } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js';
import { nanoid } from 'nanoid';

export class PublisherStore extends Config<Static<typeof Publisher>> {
  getKeyPrefix(): string {
    return "PUBLISHER"
  }

  async create(cfg: Static<typeof NewPublisher>): Promise<Static<typeof Publisher>> {
    const id = nanoid();
    const obj = {
      id,
      ...cfg
    };
    await this.db.put(this.wrapWithKeyPrefix(id), obj)
    return obj
  }

  async get(id: string): Promise<Static<typeof Publisher>> {
    return this.db.get(this.wrapWithKeyPrefix(id))
  }

  async delete(id: string): Promise<void> {
    return this.db.del(this.wrapWithKeyPrefix(id))
  }
}

