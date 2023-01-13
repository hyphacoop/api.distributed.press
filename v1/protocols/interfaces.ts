import { Static } from '@sinclair/typebox'
import { Site } from '../api/schemas'

interface SyncOptions {
  ignoreDeletes: boolean
}

interface CreateResponse {
  links: {
    [type : String]: 
  }
}

export default abstract class Protocol {
  abstract load (): Promise<void>
  abstract create<T>(config: T): Promise<Static<typeof Site>>
  abstract sync (info: Static<typeof Site>, folder: string, options: SyncOptions): Promise<void>
  abstract delete (info: Static<typeof Site>): Promise<void>
  abstract delete<T>(config: T): Promise<void>
}
