
declare module 'localdrive' {
  import MirrorDrive, { DriveLike } from 'mirror-drive'
  export default class LocalDrive {
    constructor (path: string)
    mirror (otherDrive: DriveLike): MirrorDrive
  }
}
