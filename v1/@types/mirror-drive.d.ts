
declare module 'mirror-drive' {
  import { Hyperdrive } from 'hyper-sdk'
  import LocalDrive from 'localdrive'
  export type DriveLike = LocalDrive | Hyperdrive
  export default class MirrorDrive {
    constructor (drive1: DriveLike, drive2: DriveLike)
    get count (): number
    done (): Promise<void>
    [Symbol.asyncIterator] (): AsyncIterator<{ op: string, key: string }>
  }
}
