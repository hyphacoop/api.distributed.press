import test from 'ava'
import apiBuilder from './'

test('health check /healthz', async t => {
  const server = await apiBuilder({})
  const response = await server.inject({
    method: 'GET',
    url: '/healthz'
  })
  t.is(response.statusCode, 200, 'returns a status code of 200')
})
