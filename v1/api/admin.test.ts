import test from 'ava'
import apiBuilder from './index.js'
import { makeAdminToken } from '../authorization/jwt.js'

test('create new admin, no payload', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
  })
  t.is(response.statusCode, 400, 'no payload returns a status code of 400')
})

test('create new admin, malformed payload', async t => {
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

test('create new admin, no header', async t => {
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

test('create and delete admin, happy path', async t => {
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

test('token refresh', async t => {
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

  // use refresh token to make a new admin 
  const createResponse = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      name: 'new_admin',
    }
  })
  t.is(createResponse.statusCode, 200, 'normal payload returns a status code of 200')
})

