/**
 * Reports how much of a recorded session was redundant.
 *
 *   node load-test/analyze-recording.mjs <raw-dump.json>
 *
 * Every request costs a shot at the ~2.5s cold-start tail measured in
 * docs/load-test-2026-08.md, so a repeat GET of a URL already fetched in the
 * same session is not free — it is another chance for the user to wait three
 * seconds. This counts them so the saving from client-side caching can be
 * argued from the recording rather than estimated.
 */
import { readFileSync } from 'node:fs'

function readEntries(inputPath) {
  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : parsed.entries
  if (!Array.isArray(entries)) {
    throw new Error('Input must be the sessionStorage array, or an object with an `entries` array.')
  }
  return entries
}

function toKey(entry) {
  const url = new URL(entry.url)
  return decodeURIComponent(url.pathname + url.search)
}

function summarize(entries) {
  const reads = entries.filter((entry) => (entry.method ?? 'GET').toUpperCase() === 'GET')
  const occurrences = new Map()
  for (const entry of reads) {
    const key = toKey(entry)
    occurrences.set(key, [...(occurrences.get(key) ?? []), entry])
  }

  const repeated = [...occurrences.entries()]
    .filter(([, hits]) => hits.length > 1)
    .sort((left, right) => right[1].length - left[1].length)

  const redundant = repeated.reduce((total, [, hits]) => total + hits.length - 1, 0)
  return { reads, repeated, redundant }
}

function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error('Usage: node load-test/analyze-recording.mjs <raw-dump.json>')
  }

  const { reads, repeated, redundant } = summarize(readEntries(inputPath))
  const share = reads.length ? ((redundant / reads.length) * 100).toFixed(0) : '0'

  console.log(`GET requests:        ${reads.length}`)
  console.log(`repeat GETs:         ${redundant} (${share}% of all GETs)`)
  console.log()
  console.log(' n   median ms   path')
  for (const [path, hits] of repeated) {
    const durations = hits.map((hit) => hit.durationMs).filter((value) => typeof value === 'number')
    durations.sort((left, right) => left - right)
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0
    console.log(`${String(hits.length).padStart(2)}   ${String(median).padStart(9)}   ${path}`)
  }
}

main()
