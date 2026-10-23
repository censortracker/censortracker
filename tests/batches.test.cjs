const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

function fixture() {
  let time = 0
  let ticks = 0
  const batches = load('background/batches', {}, {
    performance: { now: () => time += 8 },
    setTimeout: callback => setTimeout(() => { ticks++; callback() }, 0),
  })
  return { ...batches, ticks: () => ticks }
}

test('batch processing allows browser events before it completes', async () => {
  const state = fixture()
  const visited = []
  let interrupted = false
  setTimeout(() => { interrupted = true }, 0)
  assert.equal(await state.forEachBatch(3501, (start, end) => {
    for (let index = start; index < end; index++) visited.push(index)
    if (start > 0) assert.equal(interrupted, true)
  }), true)
  assert.deepEqual(visited, Array.from({ length: 3501 }, (_, index) => index))
})

test('batched sorting matches native sorting across partial runs and duplicates', async () => {
  const { sortBatched } = load('background/batches')
  for (const length of [0, 1, 999, 1000, 1001, 1999, 2001, 11001]) {
    const names = Array.from({ length }, (_, index) =>
      `${(Math.imul(index, 2654435761) >>> 0) % 3001}.example`)
    assert.deepEqual(Array.from(await sortBatched(names.slice(), () => true)), names.sort())
  }
})

test('sorting yields and cancels during both initial sorting and merging', async () => {
  for (const cancelAt of [1, 12]) {
    const state = fixture()
    const names = Array.from({ length: 10000 }, (_, index) => `${10000 - index}.example`)
    assert.equal(await state.sortBatched(names, () => state.ticks() < cancelAt), null)
    assert.equal(state.ticks(), cancelAt)
  }
})
