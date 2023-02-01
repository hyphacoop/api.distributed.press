import anyTest, {TestFn} from 'ava'
import { CAPABILITIES, makeJWTToken } from '../authorization/jwt.js'
import { spawnTestServer } from '../fixtures/spawnServer.js'
import { FastifyTypebox } from './index.js'

const test = anyTest as TestFn<{server: FastifyTypebox}>

test.beforeEach(async t => {
  t.context.server = await spawnTestServer()
})

test.afterEach.always(async t => {
  await t.context.server?.close()
})

test('no auth header should 401', async t => {
  const responseAdmin = await t.context.server.inject({
    method: 'POST',
    url: '/v1/admin',
    payload: {
      name: 'test_admin'
    }
  })
  t.is(responseAdmin.statusCode, 401, 'returns a status code of 401')
  const responsePublisher = await t.context.server.inject({
    method: 'POST',
    url: '/v1/publisher',
    payload: {
      name: 'test_publisher'
    }
  })
  t.is(responsePublisher.statusCode, 401, 'returns a status code of 401')
})

test('token refresh with non-refresh token should fail', async t => {
  const tokenAdmin = t.context.server.jwt.sign(makeJWTToken({ isAdmin: true, isRefresh: false }))
  const tokenPublisher = t.context.server.jwt.sign(makeJWTToken({ isAdmin: false, isRefresh: false }))
  const adminResponse = await t.context.server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${tokenAdmin}`
    },
    payload: {
      capabilities: [CAPABILITIES.PUBLISHER, CAPABILITIES.REFRESH]
    }
  })
  t.is(adminResponse.statusCode, 401, 'refreshing a non-refresh admin token returns a status code of 401')
  const publisherResponse = await t.context.server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${tokenPublisher}`
    },
    payload: {
      capabilities: [CAPABILITIES.PUBLISHER, CAPABILITIES.REFRESH]
    }
  })
  t.is(publisherResponse.statusCode, 401, 'refreshing a non-refresh publisher token returns a status code of 401')
})

test('revocation works', async t => {
  const token = makeJWTToken({ isAdmin: true, isRefresh: false })
  const signedToken = t.context.server.jwt.sign(token)
  const tokenToBeRevoked = makeJWTToken({ isAdmin: true, isRefresh: false })
  const signedTokenToBeRevoked = t.context.server.jwt.sign(tokenToBeRevoked)
  const revokeResponse = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/auth/revoke/${tokenToBeRevoked.tokenId}`,
    headers: {
      authorization: `Bearer ${signedToken}`
    }
  })
  t.is(revokeResponse.statusCode, 200, 'revocation of another token works (should return 200)')

  const failingRevokeResponse = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/auth/revoke/${token.tokenId}`,
    headers: {
      authorization: `Bearer ${signedTokenToBeRevoked}`
    }
  })
  t.is(failingRevokeResponse.statusCode, 401, 'trying to revoke the original token using the revoked token should no longer work')
})

test('revoking a tokens removes all tokens derived from that token', async t => {
  // first token
  const tokenBody = makeJWTToken({ isAdmin: true, isRefresh: true })
  const token = t.context.server.jwt.sign(tokenBody)
  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      capabilities: [CAPABILITIES.ADMIN, CAPABILITIES.PUBLISHER, CAPABILITIES.REFRESH]
    }
  })
  t.is(response.statusCode, 200, 'publisher refreshing their own token works')

  const refreshedToken = response.body
  const revokeResponse = await t.context.server.inject({
    method: 'DELETE',
    url: `/v1/auth/revoke/${tokenBody.tokenId}`,
    headers: {
      authorization: `Bearer ${refreshedToken}`
    }
  })
  t.is(revokeResponse.statusCode, 200, 'revoking original token should work')

  const newPublisherResponse = await t.context.server.inject({
    method: 'POST',
    url: '/v1/publisher',
    headers: {
      authorization: `Bearer ${refreshedToken}`
    },
    payload: {
      name: 'malicious new publisher'
    }
  })
  t.is(newPublisherResponse.statusCode, 401, 'operations with token derived from original token should also fail')
})

test('requesting new token with superset of permissions (publisher -> admin) should fail', async t => {
  const token = t.context.server.jwt.sign(makeJWTToken({ isAdmin: false, isRefresh: true }))
  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      capabilities: [CAPABILITIES.ADMIN, CAPABILITIES.PUBLISHER, CAPABILITIES.REFRESH]
    }
  })
  t.is(response.statusCode, 401)
})

test('requesting new token with subset of permissions (admin -> publisher) should work', async t => {
  const token = t.context.server.jwt.sign(makeJWTToken({ isAdmin: true, isRefresh: true }))
  const response = await t.context.server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      capabilities: [CAPABILITIES.PUBLISHER, CAPABILITIES.REFRESH]
    }
  })
  t.is(response.statusCode, 200)
})
