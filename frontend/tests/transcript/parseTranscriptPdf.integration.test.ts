import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseTranscriptPdf } from '../../src/features/transcript/utils/parseTranscriptPdf.ts'

// Integration coverage against the four real ToR reference exports (two German,
// two English) stored untracked at the repo root. They contain personal data,
// so they are not committed; the tests skip when the files are absent.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

interface ReferencePdfExpectation {
  file: string
  language: 'German' | 'English'
  entryCount: number
  gradedCount: number
  totalEcts: number
  sectionCount: number
}

const REFERENCE_PDFS: ReferencePdfExpectation[] = [
  {
    file: 'Tischberger_Ben_ToR_2026-05-08.pdf',
    language: 'German',
    entryCount: 30,
    gradedCount: 29,
    totalEcts: 186,
    sectionCount: 7,
  },
  {
    file: 'Tischberger_Ben_ToR_E_2026-05-18.pdf',
    language: 'English',
    entryCount: 30,
    gradedCount: 29,
    totalEcts: 186,
    sectionCount: 7,
  },
  {
    file: 'Straub_Carina_ToR_2026-06-11.pdf',
    language: 'German',
    entryCount: 11,
    gradedCount: 11,
    totalEcts: 69,
    sectionCount: 5,
  },
  {
    file: 'Straub_Carina_ToR_E_2026-06-11.pdf',
    language: 'English',
    entryCount: 11,
    gradedCount: 11,
    totalEcts: 69,
    sectionCount: 5,
  },
]

async function loadReferencePdf(fileName: string): Promise<File | null> {
  try {
    const buffer = await readFile(path.join(repoRoot, fileName))
    return new File([new Uint8Array(buffer)], fileName, { type: 'application/pdf' })
  } catch {
    return null
  }
}

for (const expectation of REFERENCE_PDFS) {
  test(`parses the ${expectation.language} reference ToR ${expectation.file}`, async (t) => {
    const file = await loadReferencePdf(expectation.file)
    if (!file) {
      t.skip(`reference PDF ${expectation.file} not present at repo root`)
      return
    }

    const entries = await parseTranscriptPdf(file)

    assert.equal(entries.length, expectation.entryCount)
    assert.equal(
      entries.filter((entry) => entry.extractedGrade !== null).length,
      expectation.gradedCount,
    )
    assert.equal(
      entries.reduce((sum, entry) => sum + (entry.extractedEcts ?? 0), 0),
      expectation.totalEcts,
    )
    assert.equal(
      new Set(entries.map((entry) => entry.sourceSection).filter(Boolean)).size,
      expectation.sectionCount,
    )
    for (const entry of entries) {
      assert.ok(entry.extractedTitle.length > 0)
      assert.ok(entry.extractedSemester)
      assert.match(entry.extractedSemester ?? '', /^(WS \d{4}\/\d{2}|SS \d{4})$/)
    }
  })
}

test('German and English exports of the same transcript agree on grades and categories', async (t) => {
  const germanFile = await loadReferencePdf('Tischberger_Ben_ToR_2026-05-08.pdf')
  const englishFile = await loadReferencePdf('Tischberger_Ben_ToR_E_2026-05-18.pdf')
  if (!germanFile || !englishFile) {
    t.skip('reference PDFs not present at repo root')
    return
  }

  const germanEntries = await parseTranscriptPdf(germanFile)
  const englishEntries = await parseTranscriptPdf(englishFile)

  assert.equal(germanEntries.length, englishEntries.length)

  // Row order is identical between the two language exports of the same ToR.
  for (let index = 0; index < germanEntries.length; index += 1) {
    const german = germanEntries[index]
    const english = englishEntries[index]
    assert.equal(german.extractedGrade, english.extractedGrade, `grade mismatch at row ${index}`)
    assert.equal(german.extractedEcts, english.extractedEcts, `ECTS mismatch at row ${index}`)
    assert.equal(german.extractedSemester, english.extractedSemester, `semester mismatch at row ${index}`)
    assert.equal(
      german.defaultMasterCat,
      english.defaultMasterCat,
      `default category mismatch at row ${index} (${german.extractedTitle} / ${english.extractedTitle})`,
    )
  }
})
