import assert from 'node:assert/strict'
import test from 'node:test'

import { toggleFavoriteId } from '../../src/features/favorites/utils/favoriteIds.ts'

test('toggleFavoriteId adds and removes one course without mutating the input', () => {
  const favoriteIds = ['course-a']

  const withAddedCourse = toggleFavoriteId(favoriteIds, 'course-b')
  const withRemovedCourse = toggleFavoriteId(favoriteIds, 'course-a')

  assert.deepEqual(withAddedCourse, ['course-a', 'course-b'])
  assert.deepEqual(withRemovedCourse, [])
  assert.deepEqual(favoriteIds, ['course-a'])
})

test('removing a star removes every period alias of that logical course', () => {
  const favoriteIds = ['42', '142', '99']
  assert.deepEqual(toggleFavoriteId(favoriteIds, '142', [['42', '142'], ['99']]), ['99'])
  assert.deepEqual(favoriteIds, ['42', '142', '99'])
})
