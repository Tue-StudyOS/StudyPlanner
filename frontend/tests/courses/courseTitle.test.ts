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

test('formatCourseTypeLabel deduplicates and joins types', () => {
  assert.equal(formatCourseTypeLabel(['Vorlesung', 'Übung']), 'Vorlesung + Übung')
  assert.equal(formatCourseTypeLabel(['Vorlesung', 'Vorlesung']), 'Vorlesung')
  assert.equal(formatCourseTypeLabel([]), 'Course')
})
