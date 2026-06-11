// Debug helper: dumps raw text lines (with x/y and per-item x positions) from a ToR PDF.
// Usage: node --experimental-strip-types scripts/debug-transcript-lines.ts <pdf> [filter]
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const [, , pdfName, filter] = process.argv

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const buffer = await readFile(path.join(repoRoot, pdfName))
const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
  const page = await pdfDocument.getPage(pageNumber)
  const textContent = await page.getTextContent()
  const linesByY = new Map<number, { x: number; str: string }[]>()
  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const y = Math.round(item.transform[5])
    const list = linesByY.get(y) ?? []
    list.push({ x: Math.round(item.transform[4]), str: item.str })
    linesByY.set(y, list)
  }
  for (const [y, items] of [...linesByY.entries()].sort((a, b) => b[0] - a[0])) {
    items.sort((a, b) => a.x - b.x)
    const text = items.map((i) => `[${i.x}]${i.str}`).join(' ')
    if (!filter || text.toLowerCase().includes(filter.toLowerCase())) {
      console.log(`p${pageNumber} y=${y} ${text}`)
    }
  }
}
