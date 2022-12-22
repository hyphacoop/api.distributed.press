import test from 'ava'
import apiBuilder from './index.js'
import { makeAdminToken } from '../authorization/jwt.js'

test('health check /healthz', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'GET',
    url: '/healthz'
  })
  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test('admin: no payload is 400', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
  })
  t.is(response.statusCode, 400, 'no payload returns a status code of 400')
})

test('admin: malformed payload is 400', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const token = server.jwt.sign(makeAdminToken('root', false))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      nmae: 'test_admin',
      other_field: 123
    }
  })
  t.is(response.statusCode, 400, 'malformed payload returns a status code of 400')
})

test('admin: no auth header is 401', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    payload: {
      name: 'test_admin'
    }
  })
  t.is(response.statusCode, 401, 'returns a status code of 401')
})

test('admin: create/delete is ok with token', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const token = server.jwt.sign(makeAdminToken('root', false))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      name: 'test_admin',
    }
  })
  t.is(response.statusCode, 200, 'normal payload returns a status code of 200')

  const id = response.body
  const deleteResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/admin/${id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  t.is(deleteResponse.statusCode, 200, 'deletion payload returns a status code of 200')
})

test('E2E: admin -> publisher -> site flow', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  // create an admin
  const rootAccessToken = server.jwt.sign(makeAdminToken('root', false))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${rootAccessToken}`,
    },
    payload: {
      name: 'test_admin',
    }
  })

  // make refresh JWT out of band
  const id = response.body
  const refreshToken = server.jwt.sign(makeAdminToken(id, true))
  const refreshResponse = await server.inject({
    method: 'POST',
    url: `/v1/admin/${id}/auth/refresh`,
    headers: {
      authorization: `Bearer ${refreshToken}`,
    },
  })
  t.is(refreshResponse.statusCode, 200, 'refresh payload returns a status code of 200')
  const accessToken = refreshResponse.body

  // use refresh token to make a new publisher 
  const createResponse = await server.inject({
    method: 'POST',
    url: '/v1/publisher',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      name: 'test_publisher',
    }
  })
  t.is(createResponse.statusCode, 200, 'creating a new publisher with right tokens returns a status code of 200')

  // use this publisher to create a new site
  // console.log(createResponse)
  // fetch site info
  // delete the site
})

test('auth check: publisher should not be able to access admin endpoints', async t => {
  // should not be able to make new admins
  // should not be able to make new publishers
  // should not be able to delete admins 
  // should not be able to delete publishers (including self)
})
