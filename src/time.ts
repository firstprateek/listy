export function timeAgo(ts: number, now = Date.now()): string {
  const s = (now - ts) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
