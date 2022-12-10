import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import { FastifyTypebox } from '../api/index.js';
import { JWTPayload } from './jwt.js';
import { FastifyRequest, FastifyReply, DoneFuncWithErrOrRes } from 'fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genericVerify = (accountType: "admin" | "publisher") => (request: FastifyRequest, _reply: FastifyReply, done: DoneFuncWithErrOrRes) => {
  if (!request.raw.headers.auth) {
    return done(new Error('Missing token header'))
  }

  request.jwtVerify<JWTPayload>().then((decoded) => {
    if (decoded.createdBy && decoded.accountType === accountType) {
      return done();
    } else {
      return done(new Error('Malformed JWT (wrong account type/missing fields)'))
    }
  }).catch(() => done(new Error('Cannot verify JWT')))
}


export const registerAuth = async (route: FastifyTypebox) => {
  route.decorate('verifyAdmin', genericVerify('admin'));
  route.decorate('verifyPublisher', genericVerify('publisher'));
  await route.register(auth)
  route.register(jwt, {
    secret: {
      private: readFileSync(path.join(__dirname, 'keys', 'private.key'), 'utf8'),
      public: readFileSync(path.join(__dirname, 'keys', 'public.key'), 'utf8')
    },
    sign: { algorithm: 'RS256' }
  })
}
