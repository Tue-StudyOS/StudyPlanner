import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY,
  getPlannerFavoritesLayout,
} from '../../src/features/planner/utils/favoritesLayout.ts'

test('getPlannerFavoritesLayout keeps mobile planners on the drawer flow', () => {
  assert.equal(getPlannerFavoritesLayout(true, false), 'drawer')
  assert.equal(getPlannerFavoritesLayout(true, true), 'drawer')
})

test('getPlannerFavoritesLayout stacks or docks favorites on larger screens', () => {
  assert.equal(PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY, '(min-width: 1100px)')
  assert.equal(getPlannerFavoritesLayout(false, false), 'stacked')
  assert.equal(getPlannerFavoritesLayout(false, true), 'sidebar')
})
