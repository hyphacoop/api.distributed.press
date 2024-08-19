import { ProtocolStats as ProtocolStatsType } from '../api/schemas.js'
import { Static } from '@sinclair/typebox'

import { FastifyBaseLogger } from 'fastify'

export interface SyncOptions {
  ignoreDeletes: boolean
}

export type ProtocolStats = Static<typeof ProtocolStatsType>

export interface Ctx {
  logger: FastifyBaseLogger
}

export default abstract class Protocol<ProtocolFields> {
  abstract load (): Promise<void>
  abstract unload (): Promise<void>
  abstract sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<ProtocolFields>
  abstract unsync (id: string, cfg: ProtocolFields, ctx?: Ctx): Promise<void>
  abstract stats (id: string): Promise<ProtocolStats>
}
