// Safari and iOS browsers do not implement async iteration over ReadableStream,
// which pdf.js relies on internally in getTextContent(). Without this polyfill the
// parser throws "undefined is not a function (near '...value of readableStream...')".
// Regression guard for commit c6ff1dd ("ToR fix"); keep this called before pdf.js use.
export function ensureReadableStreamAsyncIterator(): void {
  if (typeof ReadableStream === 'undefined') {
    return
  }

  const streamPrototype = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>
  }
  if (typeof streamPrototype[Symbol.asyncIterator] === 'function') {
    return
  }

  streamPrototype[Symbol.asyncIterator] = function asyncIterator(this: ReadableStream) {
    const reader = this.getReader()
    return {
      next(): Promise<IteratorResult<unknown>> {
        return reader.read() as Promise<IteratorResult<unknown>>
      },
      async return(value?: unknown): Promise<IteratorResult<unknown>> {
        reader.releaseLock()
        return { done: true, value }
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}
