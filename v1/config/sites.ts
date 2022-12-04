import { NewSite, UpdateSite, Site } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js';
import { nanoid } from 'nanoid';

export class SiteConfigStore extends Config<Static<typeof Site>> {
  getKeyPrefix(): string {
    return "SITECFG"
  }

  async create(cfg: Static<typeof NewSite>): Promise<void> {
    const id = nanoid();
    const obj = {
      id,
      publication: {
        http: {},
        hyper: {},
        ipfs: {},
      },
      ...cfg
    };
    await this.db.put(this.wrapWithKeyPrefix(id), obj)
  }

  async update(id: string, cfg: Static<typeof UpdateSite>): Promise<void> {
    const old = await this.get(id);
    const obj = {
      ...old,
      ...cfg,
    }
    await this.db.put(this.wrapWithKeyPrefix(id), obj)
  }

  async get(id: string): Promise<Static<typeof Site>> {
    return this.db.get(this.wrapWithKeyPrefix(id))
  }

  async delete(id: string): Promise<void> {
    return this.db.del(this.wrapWithKeyPrefix(id))
  }
}
