import { Config } from './store.js'
import { JWTPayloadT } from '../authorization/jwt.js'

export class RevocationStore extends Config<number> {
  async revoke (tokenId: string): Promise<void> {
    return await this.db.put(tokenId, new Date().getTime())
  }

  async isRevoked (token: JWTPayloadT): Promise<boolean> {
    try {
      await this.db.get(token.tokenId)
      return await Promise.resolve(true)
    } catch {
      return await Promise.resolve(false)
    }
  }
}
