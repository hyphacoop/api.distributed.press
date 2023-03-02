import '@fastify/jwt'
import { JWTPayloadT } from '../authorization/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayloadT
    user: JWTPayloadT
  }
}
