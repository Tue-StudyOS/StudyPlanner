import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../src/features/courses/utils/courseTitle.ts'

test('cleanCourseTitle strips parenthesized type suffixes', () => {
  assert.equal(cleanCourseTitle('Algorithmen und Datenstrukturen (Vorlesung)'), 'Algorithmen und Datenstrukturen')
  assert.equal(cleanCourseTitle('Machine Learning (Vorlesung + Übung)'), 'Machine Learning')
  assert.equal(cleanCourseTitle('Datenbanksysteme (Übung)'), 'Datenbanksysteme')
  assert.equal(cleanCourseTitle('Computer Graphics (Lecture)'), 'Computer Graphics')
})

test('cleanCourseTitle strips separator type suffixes', () => {
  assert.equal(cleanCourseTitle('Theoretische Informatik - Vorlesung'), 'Theoretische Informatik')
  assert.equal(cleanCourseTitle('Theoretische Informatik – Übung'), 'Theoretische Informatik')
  assert.equal(cleanCourseTitle('Software Engineering, Seminar'), 'Software Engineering')
})

test('cleanCourseTitle strips stacked suffixes', () => {
  assert.equal(cleanCourseTitle('Robotik - Vorlesung (Übung)'), 'Robotik')
})

test('cleanCourseTitle keeps titles without type suffixes untouched', () => {
  assert.equal(cleanCourseTitle('Einführung in die Bioinformatik'), 'Einführung in die Bioinformatik')
  assert.equal(cleanCourseTitle('Grundlagen: Maschinelles Lernen'), 'Grundlagen: Maschinelles Lernen')
})

test('cleanCourseTitle never returns an empty title', () => {
  assert.equal(cleanCourseTitle('Vorlesung'), 'Vorlesung')
  assert.equal(cleanCourseTitle('  Seminar  '), 'Seminar')
})

test('cleanCourseTitle strips the known course number anywhere in the title', () => {
  assert.equal(cleanCourseTitle('BIOINF3510 Sequence Analysis', 'BIOINF3510'), 'Sequence Analysis')
  assert.equal(cleanCourseTitle('Sequence Analysis BIOINF3510', 'BIOINF3510'), 'Sequence Analysis')
  assert.equal(cleanCourseTitle('INFO2420: Datenbanken (Vorlesung)', 'INFO2420'), 'Datenbanken')
})

test('cleanCourseTitle strips leading course codes even without a known number', () => {
  assert.equal(cleanCourseTitle('INFO2420 Datenbanken'), 'Datenbanken')
  assert.equal(cleanCourseTitle('ML-4201 Statistical Machine Learning'), 'Statistical Machine Learning')
})

test('cleanCourseTitle keeps titles that merely contain digits', () => {
  assert.equal(cleanCourseTitle('Mathematik 2'), 'Mathematik 2')
  assert.equal(cleanCourseTitle('Programmieren II'), 'Programmieren II')
})

test('formatCourseTypeLabel translates, deduplicates, and joins types', () => {
  assert.equal(formatCourseTypeLabel(['Vorlesung', 'Übung']), 'Lecture + Exercise')
  assert.equal(formatCourseTypeLabel(['Vorlesung', 'Lecture']), 'Lecture')
  assert.equal(formatCourseTypeLabel(['Hauptseminar']), 'Seminar')
  assert.equal(formatCourseTypeLabel([]), 'Course')
})
