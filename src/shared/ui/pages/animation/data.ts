type AnimationData = ReturnType<typeof readAnimation>
export type Logo = [source: number, target: number]
interface Pointer { x: number; y: number; strength: number }

export const readAnimation = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 16) {
    throw new Error('Invalid animation header')
  }
  const header = new DataView(buffer)
  const columns = header.getUint32(0, true)
  const rows = header.getUint32(4, true)
  const fps = header.getUint32(8, true)
  const count = header.getUint32(12, true)
  const stride = Math.ceil(columns * rows / 8)

  if (!columns || !rows || !fps || !count ||
    buffer.byteLength !== 16 + stride * count) {
    throw new Error('Invalid animation frames')
  }
  const duration = count / fps
  const frames = new Uint8Array(buffer, 16)

  return { columns, rows, fps, count, stride, duration, frames }
}

export const loadAnimation = async (url: string) => {
  const atlas = new Image()

  atlas.src = url
  await atlas.decode()
  const canvas = document.createElement('canvas')

  canvas.width = atlas.naturalWidth
  canvas.height = atlas.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  context.drawImage(atlas, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  // The first row stores the header; each later row stores one packed mask.
  const bytes = new Uint8Array(16 + canvas.width * (canvas.height - 1))

  for (let index = 0; index < bytes.length; index++) {
    const pixel = index < 16 ? index : canvas.width + index - 16

    bytes[index] = pixels[pixel * 4] ?? 0
  }
  const data = readAnimation(bytes.buffer)

  if (data.stride !== canvas.width || data.count !== canvas.height - 1) {
    throw new Error('Invalid animation atlas')
  }
  return data
}

const offsets: { column: number; row: number; distance: number }[] = []

for (let row = -6; row <= 6; row++) {
  for (let column = -6; column <= 6; column++) {
    const distance = column * column + row * row

    if (distance > 0 && distance <= 36) {
      offsets.push({ column, row, distance })
    }
  }
}
offsets.sort((first, second) => first.distance - second.distance)

export const frameLogos = (data: AnimationData, frame: number) => {
  const next = (frame + 1) % data.count
  const arrivals = new Set<number>()
  const active = (index: number, cell: number) => {
    const bits = data.frames[index * data.stride + Math.floor(cell / 8)] ?? 0

    return Math.floor(bits / 2 ** (cell % 8)) % 2 !== 0
  }
  const logos: Logo[] = []

  for (let cell = 0; cell < data.columns * data.rows; cell++) {
    if (active(frame, cell)) {
      logos.push([cell, active(next, cell) ? cell : -1])
    } else if (active(next, cell)) {
      arrivals.add(cell)
    }
  }
  for (const logo of logos) {
    if (logo[1] >= 0 || arrivals.size === 0) {
      continue
    }
    const sourceColumn = logo[0] % data.columns
    const sourceRow = Math.floor(logo[0] / data.columns)

    for (const offset of offsets) {
      const column = sourceColumn + offset.column
      const row = sourceRow + offset.row
      const target = row * data.columns + column

      if (column >= 0 && column < data.columns && row >= 0 &&
        row < data.rows && arrivals.delete(target)) {
        logo[1] = target
        break
      }
    }
  }
  for (const target of arrivals) {
    logos.push([-1, target])
  }
  return logos
}

export const logoOffset = (column: number, row: number,
  pointer: Pointer): [number, number] => {
  const horizontal = column + 0.5 - pointer.x
  const vertical = row + 0.5 - pointer.y
  const distance = Math.hypot(horizontal, vertical)
  const force = 2 * Math.max(0, 1 - distance / 12) * pointer.strength

  return distance ? [horizontal / distance * force, vertical / distance * force]
    : [force, 0]
}

export const logoPosition = (source: number, target: number, progress:
number, columns: number): [number, number] => {
  const start = source < 0 ? target : source
  const end = target < 0 ? source : target
  const column = start % columns + (end % columns - start % columns) * progress
  const row = Math.floor(start / columns)

  return [column, row + (Math.floor(end / columns) - row) * progress]
}
