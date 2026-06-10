import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface Item {
  id: string
  text: string
  done: boolean
  createdAt: number
}

interface ListyDB extends DBSchema {
  items: {
    key: string
    value: Item
    indexes: { 'by-createdAt': number }
  }
}

let dbPromise: Promise<IDBPDatabase<ListyDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ListyDB>('listy', 1, {
      upgrade(db) {
        const store = db.createObjectStore('items', { keyPath: 'id' })
        store.createIndex('by-createdAt', 'createdAt')
      },
    })
  }
  return dbPromise
}

/** All items, newest first. */
export async function getAllItems(): Promise<Item[]> {
  const db = await getDB()
  const items = await db.getAllFromIndex('items', 'by-createdAt')
  return items.reverse()
}

export async function putItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.put('items', item)
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('items', id)
}

// Ask the browser not to evict our data under storage pressure (matters on iOS).
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {})
}

if (import.meta.env.DEV) {
  // Dev helper: seed N items from the console, e.g. __listySeed(20000)
  ;(window as unknown as Record<string, unknown>).__listySeed = async (n = 10000) => {
    const db = await getDB()
    const tx = db.transaction('items', 'readwrite')
    const now = Date.now()
    for (let i = 0; i < n; i++) {
      void tx.store.put({
        id: crypto.randomUUID(),
        text: `Seeded thought #${n - i} — ${['call mom', 'fix the bike brake', 'read that paper on virtual scrolling', 'water the plants', 'book dentist appointment'][i % 5]}`,
        done: i % 7 === 0,
        createdAt: now - i * 60_000,
      })
    }
    await tx.done
    return n
  }
}
