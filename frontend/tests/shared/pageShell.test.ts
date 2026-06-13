import assert from 'node:assert/strict'
import test from 'node:test'
import { PAGE_SHELL_WIDTH_CLASSES } from '../../src/shared/utils/pageShell.ts'

test('page shell width variants match the catalog width cap', () => {
  assert.equal(PAGE_SHELL_WIDTH_CLASSES.default, 'max-w-[64rem]')
  assert.equal(PAGE_SHELL_WIDTH_CLASSES.narrow, 'max-w-[44rem]')
})
