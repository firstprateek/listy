import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { deleteItem, getAllItems, putItem, requestPersistence, type Item } from './db'
import { timeAgo } from './time'

const Row = memo(function Row({
  item,
  onToggle,
  onDelete,
}: {
  item: Item
  onToggle: (item: Item) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`row${item.done ? ' done' : ''}`}>
      <button
        className="check"
        aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
        onClick={() => onToggle(item)}
      />
      <span className="text">{item.text}</span>
      <span className="time">{timeAgo(item.createdAt)}</span>
      <button className="delete" aria-label="Delete" onClick={() => onDelete(item.id)}>
        ✕
      </button>
    </div>
  )
})

export default function App() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [draft, setDraft] = useState('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Merge instead of replace: items added before the initial load resolves
    // (they're already in the DB) must not be dropped from state.
    getAllItems().then((fromDb) => {
      setItems((prev) => {
        if (!prev) return fromDb
        const ids = new Set(prev.map((it) => it.id))
        return [...prev, ...fromDb.filter((it) => !ids.has(it.id))]
      })
    })
    requestPersistence()
  }, [])

  const loaded = items ?? []

  const virtualizer = useVirtualizer({
    count: loaded.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => 56,
    overscan: 12,
    getItemKey: (index) => loaded[index].id,
  })

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const item: Item = { id: crypto.randomUUID(), text, done: false, createdAt: Date.now() }
    setItems((prev) => [item, ...(prev ?? [])])
    setDraft('')
    void putItem(item)
    virtualizer.scrollToOffset(0)
  }

  const toggleItem = useCallback((item: Item) => {
    const updated = { ...item, done: !item.done }
    setItems((prev) => (prev ?? []).map((it) => (it.id === item.id ? updated : it)))
    void putItem(updated)
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev ?? []).filter((it) => it.id !== id))
    void deleteItem(id)
  }, [])

  const doneCount = loaded.reduce((n, it) => n + (it.done ? 1 : 0), 0)

  return (
    <div className="app">
      <header>
        <h1>Listy</h1>
        {items !== null && (
          <span className="count">
            {loaded.length === 0
              ? 'empty'
              : `${loaded.length} item${loaded.length === 1 ? '' : 's'}${doneCount ? ` · ${doneCount} done` : ''}`}
          </span>
        )}
      </header>

      <form className="composer" onSubmit={addItem}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What's on your mind?"
          enterKeyHint="done"
          aria-label="New item"
        />
        <button type="submit" aria-label="Add item" disabled={!draft.trim()}>
          +
        </button>
      </form>

      <div className="scroller" ref={scrollerRef}>
        {items !== null && loaded.length === 0 ? (
          <p className="empty">Nothing here yet. Type something above — it stays on this device.</p>
        ) : (
          <div className="list" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((vi) => (
              <div
                key={vi.key}
                className="row-slot"
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <Row item={loaded[vi.index]} onToggle={toggleItem} onDelete={removeItem} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
