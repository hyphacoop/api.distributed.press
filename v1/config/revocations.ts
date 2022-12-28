import { Config } from './store.js'
import { JWTPayloadT } from '../authorization/jwt.js'

export class RevocationStore extends Config {
  async revoke (tokenId: string): Promise<void> {
    return await this.db.put(tokenId, new Date().getTime())
  }

  async isRevoked (token: JWTPayloadT): Promise<boolean> {
    return this.db.get(token.id) !== undefined
  }
}
