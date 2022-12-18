import '@fastify/jwt'
import { JWTPayload } from '../authorization/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}
