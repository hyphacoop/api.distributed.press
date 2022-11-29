import { Static } from '@sinclair/typebox'
import { Site } from '../api/schemas'

interface SyncOptions {
  ignoreDeletes: boolean
}

export default abstract class Protocol {
  abstract load (): void
  abstract create<T>(config: T): Static<typeof Site>
  abstract sync (info: Static<typeof Site>, folder: string, options: SyncOptions): void
  abstract delete (info: Static<typeof Site>): void
  abstract delete<T>(config: T): void
}
