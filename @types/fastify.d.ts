import { HookHandlerDoneFunction } from 'fastify'
declare module 'fastify' {
  export interface FastifyInstance {
    verifyAdmin: (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => void
    verifyPublisher: (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => void
    verifyRefresh: (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => void
  }
}
