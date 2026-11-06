import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSpawnSlotIndex, knifeArcHit } from '../shared/combat.js'

test('spawn picker takes lowest free slot', () => {
  assert.equal(pickSpawnSlotIndex(new Set(), 4), 0)
  assert.equal(pickSpawnSlotIndex(new Set([0, 1]), 4), 2)
  assert.equal(pickSpawnSlotIndex(new Set([0, 1, 2, 3]), 4), 0)
})

test('knife arc hits in front within reach', () => {
  const o = { x: 0, y: 0 }
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: 2.0, y: 0.5 }, reach: 2.1, arc: Math.PI * (120 / 180) }), true)
})

test('knife arc misses behind and out of reach', () => {
  const o = { x: 0, y: 0 }
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: -1, y: 0 }, reach: 2.1, arc: Math.PI * (120 / 180) }), false)
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: 5, y: 0 }, reach: 2.1, arc: Math.PI * (120 / 180) }), false)
})
