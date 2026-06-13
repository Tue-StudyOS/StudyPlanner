import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSpotlightFrameStyle,
  buildSpotlightHaloStyle,
  SPOTLIGHT_DIM_BOX_SHADOW,
  SPOTLIGHT_HALO_BOX_SHADOW,
} from '../../src/features/onboarding/utils/spotlight.ts'

test('buildSpotlightFrameStyle keeps a visible cutout with a bright frame and dimmed surroundings', () => {
  const style = buildSpotlightFrameStyle({ top: 10, left: 20, width: 120, height: 60 })

  assert.equal(style.top, '10px')
  assert.equal(style.left, '20px')
  assert.equal(style.width, '120px')
  assert.equal(style.height, '60px')
  assert.equal(style.boxShadow, SPOTLIGHT_DIM_BOX_SHADOW)
  assert.match(style.boxShadow, /9999px rgba\(0, 0, 0/)
  assert.doesNotMatch(style.boxShadow, /rgba\(255, 255, 255/)
  assert.doesNotMatch(style.boxShadow, /rgba\(147, 13, 42/)
})

test('buildSpotlightHaloStyle expands the glow beyond the measured target', () => {
  const style = buildSpotlightHaloStyle({ top: 10, left: 20, width: 120, height: 60 })

  assert.equal(style.top, '4px')
  assert.equal(style.left, '14px')
  assert.equal(style.width, '132px')
  assert.equal(style.height, '72px')
  assert.equal(style.boxShadow, SPOTLIGHT_HALO_BOX_SHADOW)
  assert.doesNotMatch(style.boxShadow, /rgba\(147, 13, 42/)
})
