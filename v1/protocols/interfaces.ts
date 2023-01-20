export interface SyncOptions {
  ignoreDeletes: boolean
}

export default abstract class Protocol<ProtocolFields> {
  abstract load (): Promise<void>
  abstract sync (id: string, folderPath: string, options?: SyncOptions): Promise<ProtocolFields>
  abstract unsync (id: string, cfg: ProtocolFields): Promise<void>
}
