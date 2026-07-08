import assert from 'node:assert/strict'
import test from 'node:test'

import { toggleFavoriteId, updateSavingFavoriteIds } from '../../src/features/favorites/utils/favoriteIds.ts'

test('toggleFavoriteId adds and removes one course without mutating the input', () => {
  const favoriteIds = ['course-a']

  const withAddedCourse = toggleFavoriteId(favoriteIds, 'course-b')
  const withRemovedCourse = toggleFavoriteId(favoriteIds, 'course-a')

  assert.deepEqual(withAddedCourse, ['course-a', 'course-b'])
  assert.deepEqual(withRemovedCourse, [])
  assert.deepEqual(favoriteIds, ['course-a'])
})

test('updateSavingFavoriteIds tracks one saving entry per course', () => {
  const savingFavoriteIds = updateSavingFavoriteIds(['course-a'], 'course-a', true)

  assert.deepEqual(savingFavoriteIds, ['course-a'])
  assert.deepEqual(updateSavingFavoriteIds(savingFavoriteIds, 'course-b', true), ['course-a', 'course-b'])
  assert.deepEqual(updateSavingFavoriteIds(savingFavoriteIds, 'course-a', false), [])
})
