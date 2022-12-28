import { Config } from './store.js'
import { JWTPayloadT } from '../authorization/jwt.js'

export class RevocationStore extends Config {
  async revoke(tokenId: string): Promise<void> {
    return this.db.put(tokenId, new Date().getTime())
  }

  async isRevoked(token: JWTPayloadT): Promise<boolean> {
    try {
      await this.db.get(token.id)
      return Promise.resolve(true)
    } catch {
      return Promise.resolve(false)
    }
  }
}
