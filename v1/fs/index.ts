import path from 'path'
import fs from 'fs'
import tar from 'tar-fs'
import gunzip from 'gunzip-maybe'
import rimraf from 'rimraf'
import { BusboyFileStream } from "@fastify/busboy";

export class SiteFileSystem {
  path: string
  constructor(rootPath: string) {
    this.path = path.join(rootPath, 'sites')
  }

  async clear(siteId: string): Promise<void> {
    const sitePath = this.getPath(siteId)
    return await new Promise((resolve, reject) => rimraf(sitePath, (err) => {
      if (err === null || err === undefined) {
        resolve()
      } else {
        reject(err)
      }
    }))
  }

  getPath(siteId: string): string {
    return path.join(this.path, siteId)
  }

  /// Reads a .tar or .tar.gz from given `tarballPath` and extracts it to
  /// the target directory. Deletes original tarball when done
  async extract(stream: BusboyFileStream, siteId: string): Promise<void> {
    return await new Promise((resolve, reject) => {
      const sitePath = this.getPath(siteId)
      stream.on('error', reject)
        .pipe(gunzip()).on('error', reject)
        .pipe(tar.extract(sitePath, {
          readable: true,
          writable: false
        })).on('error', reject)
        .on('finish', resolve)
      if (stream.truncated) {
        reject('file size limit reached')
      }
    })
  }
}
