import { NewPublisher, Publisher } from '../api/schemas'
import { Static } from '@sinclair/typebox'
import { Config } from './store.js'
import { nanoid } from 'nanoid'
import createError from 'http-errors'

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

  async createTrial (cfg: Static<typeof NewPublisher>): Promise<Static<typeof Publisher>> {
    const id = cfg.name

    const sections = id.split('@')

    if (sections.length !== 2 || !sections[1].includes('.')) {
      throw createError(400, 'Name must be a valid email address.')
    }

    if (await this.has(id)) {
      throw createError(409, 'A trial for this email already exists. Please contact an administrator if you think this is a mistake.')
    }

    const obj: Static<typeof Publisher> = {
      id,
      name: id,
      ownedSites: [],
      limited: true
    }
    return await this.db.put(id, obj).then(() => obj)
  }

  async registerSiteToPublisher (publisherId: string, siteId: string): Promise<void> {
    const publisher = await this.db.get(publisherId)

    if ((publisher.limited === true) && (publisher.ownedSites.length >= 1)) {
      throw createError(402, `Your trial account already has one site registered at ${publisher.ownedSites[0]}`)
    }

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

  async has (id: string): Promise<boolean> {
    try {
      await this.get(id)
      return true
    } catch {
      return false
    }
  }

  async get (id: string): Promise<Static<typeof Publisher>> {
    return await this.db.get(id)
  }

  async delete (id: string): Promise<void> {
    return await this.db.del(id)
  }
}
