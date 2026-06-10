import { beforeEach, describe, expect, it } from 'vitest'
import { deleteItem, getAllItems, putItem, type Item } from './db'

const mk = (text: string, createdAt: number, done = false): Item => ({
  id: crypto.randomUUID(),
  text,
  done,
  createdAt,
})

beforeEach(async () => {
  for (const item of await getAllItems()) await deleteItem(item.id)
})

describe('db', () => {
  it('stores items and returns them newest first', async () => {
    const old = mk('old', 1000)
    const mid = mk('mid', 2000)
    const fresh = mk('fresh', 3000)
    await putItem(mid)
    await putItem(fresh)
    await putItem(old)
    expect((await getAllItems()).map((it) => it.text)).toEqual(['fresh', 'mid', 'old'])
  })

  it('updates in place by id', async () => {
    const item = mk('toggle me', 1000)
    await putItem(item)
    await putItem({ ...item, done: true })
    const all = await getAllItems()
    expect(all).toHaveLength(1)
    expect(all[0].done).toBe(true)
    expect(all[0].id).toBe(item.id)
  })

  it('deletes by id', async () => {
    const keep = mk('keep', 1000)
    const drop = mk('drop', 2000)
    await putItem(keep)
    await putItem(drop)
    await deleteItem(drop.id)
    expect((await getAllItems()).map((it) => it.text)).toEqual(['keep'])
  })
})
