const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { inflateSync } = require('node:zlib')
const { createHash } = require('node:crypto')
const load = require('./load.cjs')
const { readAnimation, frameLogos, logoOffset, logoPosition } = load('../ui/pages/animation/data')
const { kickLogo, stepPhysics, transferPhysics } = load('../ui/pages/animation/physics')

const readBundled = () => {
  const png = fs.readFileSync(path.join(__dirname, '../public/animations/bad-apple.png'))
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  const chunks = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const filtered = inflateSync(Buffer.concat(chunks))
  const rows = Buffer.alloc(width * height)
  for (let row = 0; row < height; row++) {
    const filter = filtered[row * (width + 1)]
    assert.ok(filter <= 2, 'The generated atlas uses None, Sub, or Up PNG filters')
    for (let column = 0; column < width; column++) {
      const index = row * width + column
      const previous = filter === 1 && column ? rows[index - 1] : filter === 2 && row ? rows[index - width] : 0
      rows[index] = filtered[row * (width + 1) + column + 1] + previous
    }
  }
  const bytes = Buffer.concat([rows.subarray(0, 16), rows.subarray(width)])
  return readAnimation(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

const masks = (far = false) => {
  const stride = far ? 1 : 2
  const bytes = Buffer.alloc(16 + stride * 2)
  for (const [index, value] of [far ? 8 : 4, far ? 1 : 3, 2, 2].entries()) bytes.writeUInt32LE(value, index * 4)
  bytes[16] = 1
  bytes[16 + stride] = far ? 128 : 2
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

test('packed masks contain only 30 seconds at 15 fps', () => {
  const data = readAnimation(masks())
  assert.equal(data.stride, 2)
  assert.equal(data.frames[0] & 1, 1)
  assert.equal(data.frames[data.stride] & 2, 2)
  const bytes = fs.readFileSync(path.join(__dirname, '../public/animations/bad-apple.png'))
  const video = readBundled()
  assert.deepEqual([video.columns, video.rows, video.fps, video.count], [80, 60, 15, 450])
  assert.ok(bytes.length < 35000)
  assert.equal(video.duration, 30)
  assert.equal(createHash('sha256').update(video.frames).digest('hex'),
    'af7439c36a186c3593b942cc62e407b950e17cc92daf2b5b13e71fe9a284a57d')
  for (const buffer of [new ArrayBuffer(0), masks().slice(0, -1), new ArrayBuffer(20)]) {
    assert.throws(() => readAnimation(buffer), /Invalid animation/)
  }
})

test('the browser atlas loader restores packed bytes and rejects invalid headers', async () => {
  const buffer = Buffer.alloc(48)
  for (const [index, value] of [32, 4, 2, 2].entries()) buffer.writeUInt32LE(value, index * 4)
  buffer[16] = 1
  buffer[32] = 2
  const pixels = new Uint8ClampedArray(buffer.length * 4)
  for (let index = 0; index < buffer.length; index++) pixels[index * 4] = buffer[index]
  let fail = false
  const { loadAnimation } = load('../ui/pages/animation/data', {}, {
    Image: class { naturalWidth = 16; naturalHeight = 3; async decode() { if (fail) throw new Error('Missing atlas') } },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }) }) },
  })
  const data = await loadAnimation('atlas.png')
  assert.deepEqual([data.columns, data.rows, data.fps, data.count], [32, 4, 2, 2])
  assert.equal(data.frames[0], 1)
  assert.equal(data.frames[data.stride], 2)
  pixels[0] = 0
  await assert.rejects(loadAnimation('atlas.png'), /Invalid animation/)
  fail = true
  await assert.rejects(loadAnimation('missing.png'), /Missing atlas/)
})

test('a click gives logos outward velocity and damped springs bring them back', () => {
  const state = new Float32Array(4)
  kickLogo(state, 0, 0, 0, 0.5, 0.5)
  assert.equal(state[2], 1260)
  assert.ok(state[2] > 0 && Number.isFinite(state[3]))
  for (let index = 0; index < 10; index++) kickLogo(state, 0, 0, 0, 0.5, 0.5)
  assert.ok(Math.hypot(state[2], state[3]) <= 1800.001)
  let maximum = 0
  for (let index = 0; index < 480; index++) {
    stepPhysics(state, 1 / 120)
    maximum = Math.max(maximum, Math.abs(state[0]))
  }
  assert.ok(maximum > 30)
  assert.ok(Math.abs(state[0]) + Math.abs(state[2]) < 0.01)
  const diagonal = new Float32Array(4)
  kickLogo(diagonal, 0, 1, 1, 0, 0)
  assert.ok(diagonal[2] > 0 && diagonal[3] > 0)
})

test('hover responds within 200 ms and returns gradually', () => {
  const state = new Float32Array(4)
  for (let frame = 0; frame < 24; frame++) stepPhysics(state, 1 / 120, [2, 0])
  assert.ok(state[0] > 0.7 && state[0] < 2)
  stepPhysics(state, 1 / 60)
  assert.ok(state[0] > 0.7)
})

test('physics stays stable at different refresh rates and keeps velocity across frame paths', () => {
  const first = new Float32Array(4), second = new Float32Array(4)
  kickLogo(first, 0, 0, 0, 0.5, 0.5)
  second.set(first)
  for (let index = 0; index < 30; index++) stepPhysics(first, 1 / 60)
  for (let index = 0; index < 60; index++) stepPhysics(second, 1 / 120)
  assert.ok(first.every((value, index) => Math.abs(value - second[index]) < 0.001))
  stepPhysics(first, 10)
  assert.ok(first.every(Number.isFinite))
  const state = new Float32Array(20), next = new Float32Array(20)
  state.set([1, 2, 3, 4])
  state.set([5, 6, 7, 8], 8)
  state.set([9, 10, 11, 12], 12)
  transferPhysics(state, next, [[0, 1], [2, 2], [-1, 3], [4, -1]])
  assert.deepEqual(Array.from(next), [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 0, 0, 0])
})

test('runtime paths match nearby cells, preserve existing logos, and include the loop', () => {
  const data = readAnimation(masks())
  assert.deepEqual(Array.from(frameLogos(data, 0), pair => Array.from(pair)), [[0, 1]])
  assert.deepEqual(Array.from(frameLogos(data, 1), pair => Array.from(pair)), [[1, 0]])
  assert.deepEqual(Array.from(frameLogos(readAnimation(masks(true)), 0), pair => Array.from(pair)), [[0, -1], [-1, 7]])
  const retained = { columns: 4, rows: 1, count: 2, stride: 1, frames: Uint8Array.from([3, 6]) }
  assert.deepEqual(Array.from(frameLogos(retained, 0), pair => Array.from(pair)), [[0, 2], [1, 1]])
  const video = readBundled()
  const active = (frame, cell) => video.frames[frame * video.stride + (cell >> 3)] & (1 << (cell % 8))
  for (let frame = 0; frame < video.count; frame++) {
    const arrivals = new Set()
    const departures = new Set()
    const next = (frame + 1) % video.count
    for (const [source, target] of frameLogos(video, frame)) {
      if (source >= 0) {
        assert.ok(active(frame, source) && !departures.has(source))
        departures.add(source)
        if (active(next, source)) assert.equal(source, target)
      }
      if (target >= 0) {
        assert.ok(active(next, target) && !arrivals.has(target))
        arrivals.add(target)
      }
      if (source >= 0 && target >= 0) assert.ok(Math.hypot(source % 80 - target % 80, Math.floor(source / 80) - Math.floor(target / 80)) <= 6)
    }
  }
})

test('pointer displacement is bounded, decreases with distance, and is finite at the center', () => {
  const pointer = { x: 0.5, y: 0.5, strength: 1 }
  assert.deepEqual(Array.from(logoOffset(0, 0, pointer)), [2, 0])
  assert.ok(logoOffset(6, 0, pointer)[0] > 0)
  assert.equal(logoOffset(12, 0, pointer)[0], 0)
  assert.ok(logoOffset(1, 0, pointer)[0] > logoOffset(4, 0, pointer)[0])
  assert.equal(logoOffset(0, 0, { ...pointer, strength: 0.5 })[0], 1)
})

async function fixture({ reduced = false, fail = '', paired = true } = {}) {
  let now = 0
  let next = 0
  const queued = new Map()
  const errors = []
  const element = () => ({ handlers: {}, attributes: {},
    addEventListener(name, handler, options) { this.handlers[name] = handler; options?.signal?.addEventListener('abort', () => { delete this.handlers[name] }) },
    setAttribute(name, value) { this.attributes[name] = value } })
  const elements = { animationCanvas: element() }
  const context = { draws: [], fillRect() { this.draws = [] },
    drawImage(...args) { this.draws.push([...args, this.globalAlpha]) } }
  const canvas = elements.animationCanvas
  canvas.getContext = () => context
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  const document = { hidden: false, documentElement: {}, handlers: {},
    getElementById: id => elements[id],
    createElement: () => ({ getContext: () => ({ drawImage() {} }) }),
    addEventListener(name, handler, options) { this.handlers[name] = handler; options?.signal?.addEventListener('abort', () => { delete this.handlers[name] }) },
  }
  const media = { matches: reduced, addEventListener(name, handler, options) { this.change = handler; options?.signal?.addEventListener('abort', () => { this.change = undefined }) } }
  let resize, disconnected = false
  const { mountAnimation } = load('../ui/pages/animation/player', {
    'browser-api': { default: { runtime: { getURL: file => file } } },
    i18n: { initializeLanguage: async () => {}, getUILanguage: () => 'en', getMessage: key => key },
    'page-errors': { showPageError: error => errors.push(error.message) },
    data: { frameLogos, logoOffset, logoPosition, loadAnimation: async () => {
      if (fail === 'atlas') throw new Error('Atlas failed')
      return readAnimation(fail === 'data' ? new ArrayBuffer(0) : masks(!paired))
    } },
  }, {
    document, devicePixelRatio: 1, matchMedia: () => media,
    performance: { now: () => now },
    Image: class { async decode() { if (fail === 'logo') throw new Error('Logo failed') } },
    ResizeObserver: class { constructor(callback) { resize = callback } observe() {} disconnect() { disconnected = true } },
    requestAnimationFrame: callback => { queued.set(++next, callback); return next },
    cancelAnimationFrame: id => queued.delete(id),
  })
  const controller = new AbortController()
  const cleanup = await mountAnimation(canvas, controller.signal).catch(error => errors.push(error.message))
  const step = (elapsed) => {
    now += elapsed
    const callbacks = [...queued.values()]
    queued.clear()
    for (const callback of callbacks) callback(now)
  }
  return { elements, canvas, context, document, media, errors, queued, step, resize,
    get disconnected() { return disconnected },
    dispose: () => { controller.abort(); cleanup?.() } }
}

test('playback starts automatically, loops repeatedly, and freezes while hidden', async () => {
  const state = await fixture()
  state.step(0)
  assert.equal(state.context.draws.length, 1)
  const firstPosition = state.context.draws[0][1]
  state.step(500)
  assert.ok(state.context.draws[0][1] > firstPosition)
  state.step(500)
  assert.equal(state.context.draws[0][1], firstPosition)
  for (let loop = 0; loop < 3; loop++) {
    state.step(1000)
    assert.equal(state.context.draws[0][1], firstPosition)
    assert.equal(state.queued.size, 1)
  }
  state.step(500)
  state.document.hidden = true
  state.document.handlers.visibilitychange()
  state.step(5000)
  state.document.hidden = false
  state.document.handlers.visibilitychange()
  state.step(0)
  assert.equal(state.context.draws[0][1], firstPosition + 200)
  state.step(250)
  assert.equal(state.context.draws[0][1], firstPosition + 100)
})

test('logos move at constant speed within each frame interval and across the loop', async () => {
  const state = await fixture()
  state.step(0)
  const start = state.context.draws[0][1]
  state.step(125)
  assert.equal(state.context.draws[0][1], start + 50)
  state.step(125)
  assert.equal(state.context.draws[0][1], start + 100)
  state.step(250)
  assert.equal(state.context.draws[0][1], start + 200)
  state.step(500)
  assert.equal(state.context.draws[0][1], start)
})

test('unpaired logos fade smoothly and reduced motion skips frame interpolation', async () => {
  const state = await fixture({ paired: false })
  state.step(250)
  assert.deepEqual(state.context.draws.map(draw => draw[3]), [0.5, 0.5])
  assert.equal(state.context.globalAlpha, 1)
  const reduced = await fixture({ reduced: true })
  reduced.step(0)
  const start = reduced.context.draws[0][1]
  reduced.step(250)
  assert.equal(reduced.context.draws[0][1], start)
})

test('hover uses springs and keeps moving after the pointer leaves', async () => {
  const state = await fixture()
  const baseline = await fixture()
  state.step(0)
  const normal = state.context.draws[0][1]
  state.canvas.handlers.pointermove({ clientX: 100, clientY: 100 })
  state.step(0)
  assert.equal(state.context.draws[0][1], normal)
  for (let index = 0; index < 20; index++) {
    state.step(16)
    baseline.step(16)
  }
  const displacement = state.context.draws[0][1] - baseline.context.draws[0][1]
  assert.ok(displacement > 100 && displacement < 400)
  state.canvas.handlers.pointerleave()
  state.step(16)
  baseline.step(16)
  assert.ok(state.context.draws[0][1] - baseline.context.draws[0][1] > 100)
  for (let index = 0; index < 280; index++) {
    state.step(16)
    baseline.step(16)
  }
  assert.ok(Math.abs(state.context.draws[0][1] - baseline.context.draws[0][1]) < 1)
  assert.equal(state.queued.size, 1)
})

test('click bursts return to the moving animation and respect reduced motion', async () => {
  const state = await fixture(), baseline = await fixture()
  state.step(0)
  baseline.step(0)
  state.canvas.handlers.click({ clientX: 100, clientY: 100 })
  state.step(16)
  baseline.step(16)
  assert.ok(state.context.draws[0][1] > baseline.context.draws[0][1] + 1500)
  for (let index = 0; index < 140; index++) {
    state.step(16)
    baseline.step(16)
  }
  assert.ok(Math.abs(state.context.draws[0][1] - baseline.context.draws[0][1]) < 1)
  state.canvas.handlers.click({ clientX: 100, clientY: 100 })
  state.media.matches = true
  state.media.change()
  state.step(16)
  baseline.media.matches = true
  baseline.media.change()
  baseline.step(16)
  assert.equal(state.context.draws[0][1], baseline.context.draws[0][1])
})

test('reduced motion disables slides and pointer effects while keeping automatic playback', async () => {
  const state = await fixture({ reduced: true })
  state.step(0)
  assert.equal(state.queued.size, 1)
  const normal = state.context.draws[0][1]
  state.canvas.handlers.pointermove({ clientX: 100, clientY: 100 })
  state.step(100)
  assert.equal(state.context.draws[0][1], normal)
  state.step(500)
  assert.ok(state.context.draws[0][1] > normal)
})

test('failed assets show an error without starting the animation', async () => {
  for (const fail of ['logo', 'atlas', 'data']) {
    const state = await fixture({ fail })
    assert.equal(state.errors.length, 1)
    assert.equal(state.queued.size, 0)
  }
})

test('animation cleanup cancels drawing and removes listeners and the resize observer', async () => {
  const state = await fixture()
  state.step(0)
  assert.equal(state.queued.size, 1)
  state.dispose()
  assert.equal(state.queued.size, 0)
  assert.deepEqual(Object.keys(state.canvas.handlers), [])
  assert.deepEqual(Object.keys(state.document.handlers), [])
  assert.equal(state.media.change, undefined)
  assert.equal(state.disconnected, true)
  state.resize()
  assert.equal(state.queued.size, 0)
})
