import test from 'ava'
import apiBuilder from './index.js'
import { CAPABILITIES, makeJWTToken } from '../authorization/jwt.js'
import { exampleSiteConfig } from '../config/sites.test.js'
import { DEFAULT_SITE_CFG } from '../config/sites.js'

test('health check /healthz', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'GET',
    url: '/healthz'
  })
  t.is(response.statusCode, 200, 'returns a status code of 200')
})

test('admin: no payload should 400', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin'
  })
  t.is(response.statusCode, 400, 'no payload returns a status code of 400')
})

test('admin: malformed payload should 400', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const token = server.jwt.sign(makeJWTToken({ isAdmin: true, isRefresh: false }))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      nmae: 'test_admin',
      other_field: 123
    }
  })
  t.is(response.statusCode, 400, 'malformed payload returns a status code of 400')
})

test('admin: create/delete should be ok with token', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })
  const token = server.jwt.sign(makeJWTToken({ isAdmin: true, isRefresh: false }))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      name: 'test_admin'
    }
  })
  t.is(response.statusCode, 200, 'normal payload returns a status code of 200')

  const id = response.body
  const deleteResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/admin/${id}`,
    headers: {
      authorization: `Bearer ${token}`
    }
  })

  t.is(deleteResponse.statusCode, 200, 'deletion payload returns a status code of 200')
})

test('E2E: admin -> publisher -> site flow', async t => {
  const server = await apiBuilder({ useMemoryBackedDB: true })

  // create an admin
  const rootAccessToken = server.jwt.sign(makeJWTToken({ isAdmin: true, isRefresh: true }))
  const response = await server.inject({
    method: 'POST',
    url: '/v1/admin',
    headers: {
      authorization: `Bearer ${rootAccessToken}`
    },
    payload: {
      name: 'test_admin'
    }
  })
  t.is(response.statusCode, 200, 'creating admin returns a status code of 200')

  // make access JWT
  const adminRefreshResponse = await server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${rootAccessToken}`
    },
    payload: {
      capabilities: [CAPABILITIES.ADMIN, CAPABILITIES.PUBLISHER]
    }
  })
  t.is(adminRefreshResponse.statusCode, 200, 'refresh payload returns a status code of 200')
  const adminAccessToken = adminRefreshResponse.body

  // use access token to make a new publisher
  const createPublisherResponse = await server.inject({
    method: 'POST',
    url: '/v1/publisher',
    headers: {
      authorization: `Bearer ${adminAccessToken}`
    },
    payload: {
      name: 'test_publisher'
    }
  })
  t.is(createPublisherResponse.statusCode, 200, 'creating a new publisher with right tokens returns a status code of 200')

  // get refresh token of new publisher
  const publisherAccessResponse = await server.inject({
    method: 'POST',
    url: '/v1/auth/exchange',
    headers: {
      authorization: `Bearer ${adminAccessToken}`
    },
    payload: {
      capabilities: [CAPABILITIES.PUBLISHER]
    }
  })
  t.is(publisherAccessResponse.statusCode, 200, 'getting access token from refresh token for new publisher returns a status code of 200')
  const publisherAccessToken = publisherAccessResponse.body

  // use access token to create a new site
  const createSiteResponse = await server.inject({
    method: 'POST',
    url: '/v1/sites',
    headers: {
      authorization: `Bearer ${publisherAccessToken}`
    },
    payload: exampleSiteConfig
  })
  t.is(createSiteResponse.statusCode, 200, 'getting refresh token for new publisher returns a status code of 200')
  const siteId: string = createSiteResponse.json().id

  // fetch site info
  const getSiteResponse = await server.inject({
    method: 'GET',
    url: `/v1/sites/${siteId}`,
    headers: {
      authorization: `Bearer ${publisherAccessToken}`
    }
  })
  t.is(getSiteResponse.statusCode, 200, 'getting site info returns a status code of 200')
  t.deepEqual(getSiteResponse.json(), {
    ...DEFAULT_SITE_CFG,
    ...exampleSiteConfig,
    id: siteId
  })

  // delete the site
  const deleteSiteResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/sites/${siteId}`,
    headers: {
      authorization: `Bearer ${publisherAccessToken}`
    }
  })
  t.is(deleteSiteResponse.statusCode, 200, 'deleting site returns a status code of 200')
})
