export function pickSpawnSlotIndex(usedIndexes, count) {
  for (let i = 0; i < count; i++) if (!usedIndexes.has(i)) return i
  return 0 // all slots used — wrap (room is effectively capped first-free anyway)
}

export function knifeArcHit({ origin, yaw, target, reach, arc }) {
  const dx = target.x - origin.x, dy = target.y - origin.y
  const distSq = dx * dx + dy * dy
  if (distSq > reach * reach || distSq === 0) return false
  const forward = { x: Math.cos(yaw), y: Math.sin(yaw) } // forward = +X local
  const len = Math.sqrt(distSq)
  const dot = (dx / len) * forward.x + (dy / len) * forward.y
  return dot >= Math.cos(arc / 2)
}
