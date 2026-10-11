// Share the time budget across phases and concurrent registry operations.
const BATCH_SIZE = 1000
let deadline = 0

export const forEachBatch = async (length: number,
  visit: (start: number, end: number) => void, current = () => true) => {
  for (let start = 0; start < length; start += BATCH_SIZE) {
    if (!current()) {
      return false
    }
    visit(start, Math.min(start + BATCH_SIZE, length))
    if (performance.now() >= deadline) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      deadline = performance.now() + 8
    }
  }
  return current()
}

export const sortBatched = async (names: string[], current: () => boolean) => {
  if (!await forEachBatch(names.length, (start, end) => {
    const sorted = names.slice(start, end).sort()

    for (let offset = start; offset < end; offset++) {
      names[offset] = sorted[offset - start]
    }
  }, current)) {
    return null
  }
  let output = new Array<string>(names.length)

  for (let width = BATCH_SIZE; width < names.length; width *= 2) {
    const input = names
    const merged = output
    let left = 0
    let right = width
    let middle = width
    let limit = Math.min(width * 2, input.length)

    if (!await forEachBatch(input.length, (start, end) => {
      for (let offset = start; offset < end; offset++) {
        if (offset === limit) {
          left = offset
          middle = Math.min(offset + width, input.length)
          right = middle
          limit = Math.min(offset + width * 2, input.length)
        }
        merged[offset] = left < middle &&
          (right >= limit || input[left] <= input[right])
          ? input[left++] : input[right++]
      }
    }, current)) {
      return null
    }
    names = merged
    output = input
  }
  return names
}
