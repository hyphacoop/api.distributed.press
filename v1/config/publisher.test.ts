import test from 'ava'
import { PublisherStore } from './publisher.js'
import { MemoryLevel } from 'memory-level'

function newPublisherStore(): PublisherStore {
  return new PublisherStore(new MemoryLevel({ valueEncoding: 'json' }))
}

test('create new publisher', async t => {
  const cfg = newPublisherStore();
  const publisher = await cfg.create({ name: "test_publisher" })
  const result = await cfg.get(publisher.id);
  t.deepEqual(result, {
    id: publisher.id,
    name: "test_publisher"
  })
  const keys = await cfg.keys();
  t.deepEqual(keys, [publisher.id])
})

test('delete publisher', async t => {
  const cfg = newPublisherStore();
  const publisher = await cfg.create({ name: "test_publisher" })
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(publisher.id)
  t.is((await cfg.keys()).length, 0)
})

