import { FastifyBaseLogger } from 'fastify'

export interface SyncOptions {
  ignoreDeletes: boolean
}

export interface Ctx {
  logger: FastifyBaseLogger
}

export default abstract class Protocol<ProtocolFields> {
  abstract load (): Promise<void>
  abstract unload (): Promise<void>
  abstract sync (id: string, folderPath: string, options?: SyncOptions, ctx?: Ctx): Promise<ProtocolFields>
  abstract unsync (id: string, cfg: ProtocolFields, ctx?: Ctx): Promise<void>
}
