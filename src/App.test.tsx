import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'
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
})
