import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTranslator,
  getBrowserLanguage,
  normalizeLanguage,
  resolveAppLanguage,
} from '../../src/features/i18n/utils/language.ts'

test('normalizeLanguage accepts German and English locales only', () => {
  assert.equal(normalizeLanguage('de-DE'), 'de')
  assert.equal(normalizeLanguage('en-US'), 'en')
  assert.equal(normalizeLanguage('fr-FR'), null)
})

test('getBrowserLanguage falls back to English for unsupported browser languages', () => {
  assert.equal(getBrowserLanguage('de-DE'), 'de')
  assert.equal(getBrowserLanguage('en-GB'), 'en')
  assert.equal(getBrowserLanguage('fr-FR'), 'en')
})

test('resolveAppLanguage prefers the persisted user language over the browser language', () => {
  assert.equal(resolveAppLanguage('de', 'en-US'), 'de')
  assert.equal(resolveAppLanguage(null, 'de-DE'), 'de')
  assert.equal(resolveAppLanguage(undefined, 'fr-FR'), 'en')
})

test('createTranslator resolves localized app chrome labels', () => {
  assert.equal(createTranslator('en')('nav.progress'), 'Progress')
  assert.equal(createTranslator('de')('nav.progress'), 'Fortschritt')
  assert.equal(createTranslator('en')('common.complete'), 'Complete')
  assert.equal(createTranslator('de')('common.complete'), 'Fertig')
})
