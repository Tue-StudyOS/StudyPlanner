import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureReadableStreamAsyncIterator } from '../../src/features/transcript/utils/ensureReadableStreamAsyncIterator.ts'

// Regression guard for the iOS/Safari ToR fix (commit c6ff1dd): pdf.js needs
// async iteration over ReadableStream, which Safari does not implement.

function createStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

test('installs an async iterator when ReadableStream lacks one', async () => {
  const prototype = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>
  }
  const original = prototype[Symbol.asyncIterator]
  delete prototype[Symbol.asyncIterator]

  try {
    assert.equal(typeof prototype[Symbol.asyncIterator], 'undefined')
    ensureReadableStreamAsyncIterator()
    assert.equal(typeof prototype[Symbol.asyncIterator], 'function')

    const collected: unknown[] = []
    for await (const chunk of createStream(['a', 'b']) as AsyncIterable<unknown>) {
      collected.push(chunk)
    }
    assert.deepEqual(collected, ['a', 'b'])
  } finally {
    if (original) {
      prototype[Symbol.asyncIterator] = original
    } else {
      delete prototype[Symbol.asyncIterator]
    }
  }
})

test('does not override an existing native async iterator', () => {
  const prototype = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>
  }
  const sentinel = function sentinelIterator() {
    throw new Error('sentinel')
  } as unknown as () => AsyncIterableIterator<unknown>
  const original = prototype[Symbol.asyncIterator]
  prototype[Symbol.asyncIterator] = sentinel

  try {
    ensureReadableStreamAsyncIterator()
    assert.equal(prototype[Symbol.asyncIterator], sentinel)
  } finally {
    if (original) {
      prototype[Symbol.asyncIterator] = original
    } else {
      delete prototype[Symbol.asyncIterator]
    }
  }
})
