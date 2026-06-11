import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLineCollection,
  DEFAULT_COLUMN_LAYOUT,
  detectColumnLayout,
  extractColumnText,
  type TranscriptLine,
} from '../../src/features/transcript/utils/transcriptPdfLines.ts'

function createLine(items: { x: number; str: string }[], y = 500, page = 1): TranscriptLine {
  const lineItems = items.map((item) => ({
    str: item.str,
    transform: [1, 0, 0, 1, item.x, y],
    width: item.str.length * 5,
  }))
  return {
    page,
    y,
    x: Math.min(...items.map((item) => item.x)),
    text: items.map((item) => item.str).join(' '),
    items: lineItems,
  }
}

// x positions taken from the real German ToR export header.
const GERMAN_HEADER = createLine([
  { x: 57, str: 'Bezeichnung der Leistung' },
  { x: 303, str: 'Semester' },
  { x: 366, str: 'Prüfer/in' },
  { x: 434, str: 'Form' },
  { x: 462, str: 'Note' },
  { x: 488, str: 'Status' },
  { x: 525, str: 'CP' },
])

// x positions taken from the real English ToR export header, which sits a few
// points left of the German layout.
const ENGLISH_HEADER = createLine([
  { x: 57, str: 'Examination/Course' },
  { x: 303, str: 'Semester' },
  { x: 366, str: 'Examiner' },
  { x: 428, str: 'Form' },
  { x: 456, str: 'Grade' },
  { x: 488, str: 'Status' },
  { x: 525, str: 'CP' },
])

test('detectColumnLayout reads boundaries from the German header row', () => {
  const layout = detectColumnLayout(GERMAN_HEADER)

  assert.ok(layout)
  assert.equal(layout.semesterMinX, 299)
  assert.equal(layout.gradeMinX, 458)
  assert.equal(layout.ectsMinX, 521)
})

test('detectColumnLayout keeps a shifted English grade column out of the form column', () => {
  const layout = detectColumnLayout(ENGLISH_HEADER)
  assert.ok(layout)

  // Real row from the English ToR (page 2): the grade sits at x=456, left of
  // the historical hardcoded boundary of 460, so it used to be dropped.
  const row = createLine([
    { x: 62, str: 'Einführung in die Psychologie II' },
    { x: 303, str: 'st 2025' },
    { x: 443, str: 'O' },
    { x: 456, str: '3.30' },
    { x: 498, str: 'BE' },
    { x: 531, str: '3' },
  ])

  assert.equal(extractColumnText(row, layout.gradeMinX, layout.statusMinX), '3.30')
  assert.equal(extractColumnText(row, layout.formMinX, layout.gradeMinX), 'O')
  assert.equal(extractColumnText(row, layout.statusMinX, layout.ectsMinX), 'BE')
  assert.equal(extractColumnText(row, layout.ectsMinX), '3')

  // The historical fixed layout misclassified the same grade cell.
  assert.equal(
    extractColumnText(row, DEFAULT_COLUMN_LAYOUT.gradeMinX, DEFAULT_COLUMN_LAYOUT.statusMinX),
    '',
  )
})

test('detectColumnLayout ignores ordinary course rows and incomplete headers', () => {
  const courseRow = createLine([
    { x: 62, str: 'Modern Search Engines' },
    { x: 303, str: 'st 2025' },
    { x: 462, str: '2.3' },
    { x: 497, str: 'BE' },
    { x: 534, str: '6' },
  ])
  assert.equal(detectColumnLayout(courseRow), null)

  const partialHeader = createLine([
    { x: 303, str: 'Semester' },
    { x: 488, str: 'Status' },
  ])
  assert.equal(detectColumnLayout(partialHeader), null)
})

test('buildLineCollection groups items into x-sorted lines by rounded y', () => {
  const items = [
    { str: 'BE', transform: [1, 0, 0, 1, 497, 545.2], width: 10 },
    { str: 'Mathematik', transform: [1, 0, 0, 1, 62, 545.4], width: 50 },
    { str: 'Footer', transform: [1, 0, 0, 1, 57, 30], width: 30 },
  ]

  const lines = buildLineCollection(items, 1)

  assert.equal(lines.length, 2)
  assert.equal(lines[0].text, 'Mathematik BE')
  assert.equal(lines[0].y, 545)
  assert.equal(lines[1].text, 'Footer')
})
