// Manual validation harness: parses the four reference ToR PDFs from the repo
// root and prints a per-file summary. Run from frontend/:
//   npm run validate:transcripts
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTranscriptPdf } from '../src/features/transcript/utils/parseTranscriptPdf.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const REFERENCE_PDFS = [
  { file: 'Tischberger_Ben_ToR_2026-05-08.pdf', language: 'German' },
  { file: 'Straub_Carina_ToR_2026-06-11.pdf', language: 'German' },
  { file: 'Tischberger_Ben_ToR_E_2026-05-18.pdf', language: 'English' },
  { file: 'Straub_Carina_ToR_E_2026-06-11.pdf', language: 'English' },
]

let failures = 0

for (const { file, language } of REFERENCE_PDFS) {
  const absolutePath = path.join(repoRoot, file)
  let buffer: Buffer
  try {
    buffer = await readFile(absolutePath)
  } catch {
    console.error(`MISSING  ${file} (expected at repo root)`)
    failures += 1
    continue
  }

  try {
    const pdfFile = new File([new Uint8Array(buffer)], file, { type: 'application/pdf' })
    const entries = await parseTranscriptPdf(pdfFile)
    const withGrade = entries.filter((entry) => entry.extractedGrade !== null).length
    const withIssues = entries.filter((entry) => entry.parseIssues.length > 0)
    const totalEcts = entries.reduce((sum, entry) => sum + (entry.extractedEcts ?? 0), 0)
    const sections = [...new Set(entries.map((entry) => entry.sourceSection ?? '(none)'))]

    console.log(`OK       ${file} [${language}]`)
    console.log(`         entries=${entries.length} graded=${withGrade} totalEcts=${totalEcts}`)
    console.log(`         sections=${sections.length}: ${sections.join(' | ')}`)
    for (const entry of entries) {
      const grade = entry.extractedGrade === null ? '—' : entry.extractedGrade.toFixed(1)
      console.log(`         - [${entry.extractedSemester}] ${entry.extractedTitle} (grade=${grade}, ects=${entry.extractedEcts}, cat=${entry.defaultMasterCat})`)
    }
    if (withIssues.length > 0) {
      console.log(`         parseIssues on ${withIssues.length} entries:`)
      for (const entry of withIssues) {
        console.log(`         ! ${entry.extractedTitle}: ${entry.parseIssues.join('; ')}`)
      }
    }
  } catch (error) {
    console.error(`FAILED   ${file}: ${error instanceof Error ? error.message : String(error)}`)
    failures += 1
  }
}

process.exit(failures > 0 ? 1 : 0)
