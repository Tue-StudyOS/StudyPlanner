/**
 * Maps over items with at most `limit` operations in flight at once.
 *
 * This exists because unbounded `Promise.all` over large API responses wedges
 * the backend. A browser multiplexes concurrent fetches onto one HTTP/2
 * connection, that connection is pinned to a single Python Worker isolate, and
 * the isolate has to hold every in-flight response body at the same time. Past
 * roughly 4 MB of concurrent response bytes the isolate's event loop hangs and
 * stays hung, so every later request from that user fails too.
 *
 * Measured thresholds and the full causal chain are in docs/load-test-2026-08.md.
 *
 * Results keep input order, so callers can zip them against the input.
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  limit: number,
  operation: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (limit < 1) {
    throw new Error(`mapWithConcurrency needs a limit of at least 1, got ${limit}`)
  }

  const results = new Array<TOutput>(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await operation(items[index], index)
    }
  }

  // One worker per slot, each pulling the next item as it frees up. Fewer
  // workers than the limit when there is less work than capacity.
  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
