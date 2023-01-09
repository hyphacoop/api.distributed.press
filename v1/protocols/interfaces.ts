import { Static } from '@sinclair/typebox'
import { Site } from '../api/schemas'

interface SyncOptions {
  ignoreDeletes: boolean
}

export default abstract class Protocol<ProtocolConfig> {
  abstract load (): Promise<void>
  abstract create (config: ProtocolConfig): Promise<Static<typeof Site>>
  abstract sync (info: Static<typeof Site>, folderPath: string, options: SyncOptions): Promise<void>
  abstract delete (info: Static<typeof Site>): Promise<void>
  abstract delete (config: ProtocolConfig): Promise<void>
}
