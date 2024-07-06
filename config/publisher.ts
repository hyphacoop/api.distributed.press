import { NewPublisher, Publisher } from '../api/schemas.js'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'

export class PublisherStore extends Config<Static<typeof Publisher>> {
  async create (cfg: Static<typeof NewPublisher>): Promise<Static<typeof Publisher>> {
    const id = nanoid()
    const obj: Static<typeof Publisher> = {
      id,
      ownedSites: [],
      ...cfg
    }
    return await this.db.put(id, obj).then(() => obj)
  }

  async registerSiteToPublisher (publisherId: string, siteId: string): Promise<void> {
    const publisher = await this.db.get(publisherId)
    const newSiteList = new Set([...publisher.ownedSites, siteId])
    return await this.db.put(publisherId, {
      ...publisher,
      ownedSites: Array.from(newSiteList)
    })
  }

  async unregisterSiteFromAllPublishers (siteId: string): Promise<void> {
    for await (const [publisherId, publisher] of this.db.iterator()) {
      if (publisher.ownedSites.includes(siteId)) {
        const newSiteList = publisher.ownedSites.filter(id => siteId !== id)
        await this.db.put(publisherId, {
          ...publisher,
          ownedSites: newSiteList
        })
      }
    }
  }

  async get (id: string): Promise<Static<typeof Publisher>> {
    return await this.db.get(id)
  }

  async delete (id: string): Promise<void> {
    return await this.db.del(id)
  }
}
