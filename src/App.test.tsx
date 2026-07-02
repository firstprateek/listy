import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
