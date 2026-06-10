import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

const NOW = new Date('2026-06-10T12:00:00Z').getTime()

describe('timeAgo', () => {
  it('returns "now" under a minute', () => {
    expect(timeAgo(NOW - 5_000, NOW)).toBe('now')
    expect(timeAgo(NOW - 59_000, NOW)).toBe('now')
  })

  it('returns minutes under an hour', () => {
    expect(timeAgo(NOW - 60_000, NOW)).toBe('1m')
    expect(timeAgo(NOW - 59 * 60_000, NOW)).toBe('59m')
  })

  it('returns hours under a day', () => {
    expect(timeAgo(NOW - 3_600_000, NOW)).toBe('1h')
    expect(timeAgo(NOW - 23 * 3_600_000, NOW)).toBe('23h')
  })

  it('returns a short date at a day or older', () => {
    const ts = NOW - 3 * 86_400_000
    expect(timeAgo(ts, NOW)).toBe(
      new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    )
  })

  it('treats future timestamps as "now"', () => {
    expect(timeAgo(NOW + 10_000, NOW)).toBe('now')
  })
})
