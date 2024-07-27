import path from 'path'
import fs from 'fs'
import tar from 'tar-fs'
import gunzip from 'gunzip-maybe'
import { rimraf } from 'rimraf'
import { pipeline } from 'stream/promises'
import makeDir from 'make-dir'

export class SiteFileSystem {
  path: string
  constructor (rootPath: string) {
    this.path = path.join(rootPath, 'sites')
  }

  async clear (siteId: string): Promise<void> {
    const sitePath = this.getPath(siteId)
    await rimraf(sitePath)
  }

  getPath (siteId: string): string {
    return path.join(this.path, siteId)
  }

  async makeFolder (siteId: string): Promise<string> {
    const sitePath = this.getPath(siteId)
    return await makeDir(sitePath)
  }

  /// Reads a .tar or .tar.gz from given `tarballPath` and extracts it to
  /// the target directory
  async extract (tarballPath: string, siteId: string): Promise<string> {
    const sitePath = this.getPath(siteId)
    await pipeline(
      fs.createReadStream(tarballPath),
      gunzip(),
      tar.extract(sitePath, {
        readable: true,
        writable: true
      })
    )
    return sitePath
  }
}
