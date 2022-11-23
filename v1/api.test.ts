import test from 'ava';
import makeServer from './api';

test('health check /healthz', async t => {
  const server = makeServer()
  const response = await server.inject({
    method: 'GET',
    url: '/healthz'
  })
  t.is(response.statusCode, 200, 'returns a status code of 200')
})
