import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { deleteItem, getAllItems, putItem, type Item } from './db'

// Wrap the real db functions in spies so individual tests can force failures.
vi.mock('./db', { spy: true })

// Read the stylesheet directly: vitest replaces CSS imports (even ?raw) with empty modules.
const css = readFileSync('src/index.css', 'utf8')

const mk = (text: string, createdAt: number, done = false): Item => ({
  id: crypto.randomUUID(),
  text,
  done,
  createdAt,
})

beforeEach(async () => {
  for (const item of await getAllItems()) await deleteItem(item.id)
})

async function addViaForm(container: HTMLElement, text: string) {
  fireEvent.change(screen.getByLabelText('New item'), { target: { value: text } })
  fireEvent.submit(container.querySelector('form.composer')!)
}

describe('App', () => {
  it('shows the empty state when there are no items', async () => {
    render(<App />)
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('shows a loading state, not an empty list, until the initial load resolves', async () => {
    let resolveLoad!: (items: Item[]) => void
    vi.mocked(getAllItems).mockReturnValueOnce(
      new Promise<Item[]>((resolve) => {
        resolveLoad = resolve
      }),
    )
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('.list')).not.toBeInTheDocument()
    expect(screen.queryByText(/Nothing here yet/)).not.toBeInTheDocument()
    resolveLoad([mk('eventual note', 1000)])
    expect(await screen.findByText('eventual note')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('loads existing items from the database, newest first', async () => {
    await putItem(mk('older note', 1000))
    await putItem(mk('newer note', 2000))
    render(<App />)
    expect(await screen.findByText('newer note')).toBeInTheDocument()
    expect(screen.getByText('older note')).toBeInTheDocument()
    const texts = [...document.querySelectorAll('.row .text')].map((el) => el.textContent)
    expect(texts).toEqual(['newer note', 'older note'])
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('adds an item, clears the input, and persists it', async () => {
    const { container } = render(<App />)
    await screen.findByText(/Nothing here yet/)
    await addViaForm(container, 'buy milk')
    expect(await screen.findByText('buy milk')).toBeInTheDocument()
    expect(screen.getByLabelText('New item')).toHaveValue('')
    expect(screen.getByText('1 item')).toBeInTheDocument()
    const all = await getAllItems()
    expect(all).toHaveLength(1)
    expect(all[0].text).toBe('buy milk')
  })

  it('keeps focus in the composer after consecutive submissions', async () => {
    const { container } = render(<App />)
    await screen.findByText(/Nothing here yet/)
    const input = screen.getByLabelText('New item')
    await addViaForm(container, 'first capture')
    await screen.findByText('first capture')
    expect(document.activeElement).toBe(input)
    await addViaForm(container, 'second capture')
    await screen.findByText('second capture')
    expect(document.activeElement).toBe(input)
  })

  it('trims surrounding whitespace on add', async () => {
    const { container } = render(<App />)
    await screen.findByText(/Nothing here yet/)
    await addViaForm(container, '   padded   ')
    expect(await screen.findByText('padded')).toBeInTheDocument()
    expect((await getAllItems())[0].text).toBe('padded')
  })

  it('rejects whitespace-only submissions', async () => {
    const { container } = render(<App />)
    await screen.findByText(/Nothing here yet/)
    await addViaForm(container, '    ')
    expect(await getAllItems()).toHaveLength(0)
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled()
  })

  it('toggles done state and persists it', async () => {
    await putItem(mk('task', 1000))
    render(<App />)
    await screen.findByText('task')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    expect(await screen.findByRole('button', { name: 'Mark as not done' })).toBeInTheDocument()
    expect(screen.getByText(/1 done/)).toBeInTheDocument()
    expect((await getAllItems())[0].done).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as not done' }))
    await screen.findByRole('button', { name: 'Mark as done' })
    expect((await getAllItems())[0].done).toBe(false)
  })

  it('deletes an item and updates the count', async () => {
    await putItem(mk('keep', 1000))
    await putItem(mk('drop', 2000))
    render(<App />)
    await screen.findByText('drop')
    const dropRow = screen.getByText('drop').closest('.row')!
    fireEvent.click(dropRow.querySelector('.delete')!)
    expect(await screen.findByText('1 item')).toBeInTheDocument()
    expect(screen.queryByText('drop')).not.toBeInTheDocument()
    expect((await getAllItems()).map((it) => it.text)).toEqual(['keep'])
  })

  it('shows the done count in the header', async () => {
    await putItem(mk('a', 1000, true))
    await putItem(mk('b', 2000))
    render(<App />)
    expect(await screen.findByText('2 items · 1 done')).toBeInTheDocument()
  })

  it('reverts the optimistic add and shows an error when the save fails', async () => {
    const { container } = render(<App />)
    await screen.findByText(/Nothing here yet/)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(putItem).mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    )
    await addViaForm(container, 'doomed item')
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save/i)
    expect(screen.queryByText('doomed item')).not.toBeInTheDocument()
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(await getAllItems()).toHaveLength(0)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('keeps relative timestamps fresh as time passes', async () => {
    const createdAt = new Date('2026-06-10T12:00:00Z').getTime()
    // Fake timers must be on before render so the ticker interval lands on the
    // fake clock; the initial load resolves via microtasks, which stay real.
    vi.useFakeTimers({ now: createdAt })
    vi.mocked(getAllItems).mockResolvedValueOnce([mk('aging note', createdAt)])
    try {
      render(<App />)
      await act(async () => {})
      expect(screen.getByText('aging note')).toBeInTheDocument()
      expect(screen.getByText('now')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(65_000)
      })
      expect(screen.getByText('1m')).toBeInTheDocument()
      expect(screen.queryByText('now')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps items added while the initial load is pending, without duplicating them', async () => {
    // Simulate a slow device: getAllItems hangs while the user starts typing.
    let resolveLoad!: (items: Item[]) => void
    vi.mocked(getAllItems).mockReturnValueOnce(
      new Promise<Item[]>((resolve) => {
        resolveLoad = resolve
      }),
    )
    const { container } = render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await addViaForm(container, 'quick thought')
    expect(await screen.findByText('quick thought')).toBeInTheDocument()
    // The add persisted via the real putItem even though the load is pending.
    const saved = await getAllItems()
    expect(saved.map((it) => it.text)).toEqual(['quick thought'])
    // The load resolves late and even includes the just-added item (a slow read
    // can snapshot after the write commits): merge must dedupe by id, not drop.
    resolveLoad([...saved, mk('from before', 500)])
    expect(await screen.findByText('from before')).toBeInTheDocument()
    expect(screen.getAllByText('quick thought')).toHaveLength(1)
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('adds an item when Enter is pressed in the composer', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Nothing here yet/)
    await user.type(screen.getByLabelText('New item'), 'typed with enter{Enter}')
    expect(await screen.findByText('typed with enter')).toBeInTheDocument()
    expect(screen.getByLabelText('New item')).toHaveValue('')
    const all = await getAllItems()
    expect(all.map((it) => it.text)).toEqual(['typed with enter'])
  })

  it('persists adds and toggles across a reload (unmount and remount)', async () => {
    const first = render(<App />)
    await screen.findByText(/Nothing here yet/)
    await addViaForm(first.container, 'survives reload')
    await screen.findByText('survives reload')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    await screen.findByRole('button', { name: 'Mark as not done' })
    // Let the fire-and-forget writes commit before "closing the tab".
    await waitFor(async () => expect((await getAllItems())[0]?.done).toBe(true))
    first.unmount()

    render(<App />)
    expect(await screen.findByText('survives reload')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as not done' })).toBeInTheDocument()
    expect(screen.getByText('1 item · 1 done')).toBeInTheDocument()
  })

  it('keeps the empty state after the last item is deleted, across a reload', async () => {
    await putItem(mk('ephemeral', 1000))
    const first = render(<App />)
    await screen.findByText('ephemeral')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText(/Nothing here yet/)
    await waitFor(async () => expect(await getAllItems()).toHaveLength(0))
    first.unmount()

    render(<App />)
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.queryByText('ephemeral')).not.toBeInTheDocument()
  })

  it('reverts the toggle and shows an error when the save fails', async () => {
    await putItem(mk('stubborn', 1000))
    render(<App />)
    await screen.findByText('stubborn')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(putItem).mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save/i)
    expect(screen.getByRole('button', { name: 'Mark as done' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as not done' })).not.toBeInTheDocument()
    expect(screen.queryByText(/1 done/)).not.toBeInTheDocument()
    expect((await getAllItems())[0].done).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('does not clobber a newer toggle when an older toggle save fails late', async () => {
    await putItem(mk('flip flop', 1000))
    render(<App />)
    await screen.findByText('flip flop')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // First toggle's save hangs; we fail it after a second toggle already won.
    let rejectFirstSave!: (err: unknown) => void
    vi.mocked(putItem).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirstSave = reject
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    // Second toggle (back to not-done) goes through the real putItem.
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as not done' }))
    await screen.findByRole('button', { name: 'Mark as done' })
    await waitFor(async () => expect((await getAllItems())[0].done).toBe(false))
    // Now the stale save fails: the revert must not resurrect done=true.
    await act(async () => {
      rejectFirstSave(new DOMException('late failure', 'UnknownError'))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save/i)
    expect(screen.getByRole('button', { name: 'Mark as done' })).toBeInTheDocument()
    expect(screen.queryByText(/1 done/)).not.toBeInTheDocument()
    expect((await getAllItems())[0].done).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('virtualizes 20,000 items: bounded DOM, correct total height, far jumps render', async () => {
    const many: Item[] = Array.from({ length: 20_000 }, (_, i) => ({
      id: `bulk-${i}`,
      text: `bulk note ${i}`,
      done: false,
      createdAt: 100_000_000 - i,
    }))
    vi.mocked(getAllItems).mockResolvedValueOnce(many)
    render(<App />)
    expect(await screen.findByText('bulk note 0')).toBeInTheDocument()
    expect(screen.getByText('20000 items')).toBeInTheDocument()
    // Only a window of rows is mounted (600px viewport / 56px rows + overscan 12).
    const mounted = document.querySelectorAll('.row-slot').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(60)
    // Scrollable area accounts for every row.
    const list = document.querySelector<HTMLElement>('.list')!
    expect(list.style.height).toBe(`${20_000 * 56}px`)
    // Jump deep into the list: the window follows, DOM stays bounded.
    const scroller = document.querySelector<HTMLElement>('.scroller')!
    scroller.scrollTop = 10_000 * 56
    fireEvent.scroll(scroller)
    expect(await screen.findByText('bulk note 10000')).toBeInTheDocument()
    expect(screen.queryByText('bulk note 0')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.row-slot').length).toBeLessThan(60)
  })

  it('restores the item in place and shows an error when the delete fails', async () => {
    await putItem(mk('keep', 1000))
    await putItem(mk('sticky', 2000))
    render(<App />)
    await screen.findByText('sticky')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(deleteItem).mockRejectedValueOnce(new DOMException('boom', 'UnknownError'))
    const stickyRow = screen.getByText('sticky').closest('.row')!
    fireEvent.click(stickyRow.querySelector('.delete')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't delete/i)
    const texts = [...document.querySelectorAll('.row .text')].map((el) => el.textContent)
    expect(texts).toEqual(['sticky', 'keep'])
    expect((await getAllItems()).map((it) => it.text)).toEqual(['sticky', 'keep'])
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

// WCAG relative luminance + contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio)
function getContrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

describe('stylesheet accessibility', () => {
  it('light-mode muted text meets WCAG AA (4.5:1) on surface and background', () => {
    // First --muted declaration is the light theme (dark override lives in a media query below it).
    const muted = css.match(/--muted:\s*(#[0-9a-fA-F]{6})/)![1]
    expect(getContrastRatio(muted, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(muted, '#fafafa')).toBeGreaterThanOrEqual(4.5)
  })

  it('defines keyboard focus indicators and a reduced-motion fallback', () => {
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('gives the check and delete buttons a 44px minimum hit area', () => {
    for (const selector of ['.check', '.delete']) {
      const block = css.match(new RegExp(`\\${selector} \\{[^}]*\\}`))?.[0]
      expect(block).toMatch(/min-width: 44px/)
      expect(block).toMatch(/min-height: 44px/)
    }
  })
})
