import fastify, { DoneFuncWithErrOrRes } from 'fastify'
declare module 'fastify' {
  export interface FastifyInstance {
    verifyAdmin(): (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => void
    verifyPublisher(): (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => void
  }
}
