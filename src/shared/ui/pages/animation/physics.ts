import type { Logo } from './data'

// Typed arrays read as zero outside their bounds.
const at = (values: Float32Array, index: number) => values[index] ?? 0

export const kickLogo = (state: Float32Array, cell: number, column: number,
  row: number, clickX: number, clickY: number) => {
  const offset = cell * 4
  const horizontal = column + 0.5 + at(state, offset) - clickX
  const vertical = row + 0.5 + at(state, offset + 1) - clickY
  const distance = Math.hypot(horizontal, vertical)
  const speed = 360 + 900 / (1 + distance / 12)
  let velocityX = at(state, offset + 2) +
    (distance ? horizontal / distance : 1) * speed
  let velocityY = at(state, offset + 3) +
    (distance ? vertical / distance : 0) * speed
  const velocity = Math.hypot(velocityX, velocityY)

  if (velocity > 1800) {
    velocityX *= 1800 / velocity
    velocityY *= 1800 / velocity
  }
  state[offset + 2] = velocityX
  state[offset + 3] = velocityY
}

export const stepPhysics = (state: Float32Array, elapsed: number, targets?:
Float32Array) => {
  const steps = Math.ceil(Math.min(elapsed, 0.05) * 120)
  const delta = Math.min(elapsed, 0.05) / steps

  for (let step = 0; step < steps; step++) {
    for (let offset = 0; offset < state.length; offset += 4) {
      for (let axis = 0; axis < 2; axis++) {
        const position = offset + axis
        const target = targets?.[offset / 2 + axis] ?? 0
        const acceleration = 64 * (target - at(state, position)) -
          12 * at(state, position + 2)
        // Round like the stored values, so the next step reads the same.
        const velocity =
          Math.fround(at(state, position + 2) + acceleration * delta)
        const next = Math.fround(at(state, position) + velocity * delta)
        const settled = Math.abs(next - target) + Math.abs(velocity) < 0.001

        state[position + 2] = settled ? 0 : velocity
        state[position] = settled ? target : next
      }
    }
  }
}

export const transferPhysics = (state: Float32Array, next: Float32Array,
  logos: Logo[]) => {
  next.fill(0)
  for (const [source, target] of logos) {
    if (target < 0) {
      continue
    }
    const cell = source < 0 ? target : source

    for (let axis = 0; axis < 4; axis++) {
      next[target * 4 + axis] = at(state, cell * 4 + axis)
    }
  }
}
