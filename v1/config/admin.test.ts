import test from 'ava'
import { AdminStore } from './admin.js'
import { MemoryLevel } from 'memory-level'

function newAdminStore(): AdminStore {
  return new AdminStore(new MemoryLevel({ valueEncoding: 'json' }))
}

test('create new admin', async t => {
  const cfg = newAdminStore();
  const id = await cfg.create({ name: "test_admin" })
  const result = await cfg.get(id);
  t.deepEqual(result, {
    id,
    name: "test_admin"
  })
  const keys = await cfg.keys();
  t.deepEqual(keys, [id])
})

test('delete admin', async t => {
  const cfg = newAdminStore();
  const id = await cfg.create({ name: "test_admin" })
  t.is((await cfg.keys()).length, 1)
  await cfg.delete(id)
  t.is((await cfg.keys()).length, 0)
})
