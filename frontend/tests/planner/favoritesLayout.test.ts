import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY,
  getPlannerFavoritesLayout,
} from '../../src/features/planner/utils/favoritesLayout.ts'

test('getPlannerFavoritesLayout stacks favorites when no sidebar space is available', () => {
  assert.equal(PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY, '(min-width: 1100px)')
  assert.equal(getPlannerFavoritesLayout(false), 'stacked')
})

test('getPlannerFavoritesLayout docks favorites beside the planner when space allows', () => {
  assert.equal(getPlannerFavoritesLayout(true), 'sidebar')
})
