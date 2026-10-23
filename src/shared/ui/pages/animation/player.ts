import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import type { Logo } from './data'
import { frameLogos, loadAnimation, logoOffset, logoPosition } from './data'
import { kickLogo, stepPhysics, transferPhysics } from './physics'

export const mountAnimation = async (
  canvas: HTMLCanvasElement, signal: AbortSignal,
) => {
  const logo = new Image()

  logo.src = browser.runtime.getURL('images/rkn.png')
  const [data] = await Promise.all([
    loadAnimation(browser.runtime.getURL('animations/bad-apple.png')),
    logo.decode(),
  ])

  if (signal.aborted) {
    return () => {}
  }
  const context = canvas.getContext('2d')
  const sprite = document.createElement('canvas')
  const spriteContext = sprite.getContext('2d')

  if (!context || !spriteContext) {
    throw new Error('Canvas is unavailable')
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const pointer = { x: 0, y: 0, strength: 0 }
  let time = 0
  let previous = performance.now()
  let pending = 0
  let lastFrame = -1
  let cellSize = 1
  let transitionFrame = -1
  let logos: Logo[] = []
  let physics = new Float32Array(data.columns * data.rows * 4)
  let nextPhysics = new Float32Array(physics.length)
  const hover = new Float32Array(physics.length / 2)

  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', getMessage('animationDescription'))
  const requestDraw = () => {
    if (!signal.aborted && !pending && !document.hidden) {
      pending = requestAnimationFrame(render)
    }
  }
  const render = (now: number) => {
    pending = 0
    const elapsed = (now - previous) / 1000

    time = (time + elapsed) % data.duration
    previous = now
    const frame = Math.min(data.count - 1, Math.floor(time * data.fps))
    const progress = reducedMotion.matches ? 0 : time * data.fps - frame

    if (frame !== transitionFrame) {
      transferPhysics(physics, nextPhysics, logos)
      const oldPhysics = physics

      physics = nextPhysics
      nextPhysics = oldPhysics
      logos = frameLogos(data, frame)
      transitionFrame = frame
    }
    if (!reducedMotion.matches) {
      hover.fill(0)
      if (pointer.strength) {
        for (const [source, target] of logos) {
          const cell = source < 0 ? target : source
          const [column, row] =
            logoPosition(source, target, progress, data.columns)
          const [horizontal, vertical] = logoOffset(column, row, pointer)

          hover[cell * 2] = horizontal
          hover[cell * 2 + 1] = vertical
        }
      }
      stepPhysics(physics, elapsed, hover)
    }
    if (!reducedMotion.matches || frame !== lastFrame) {
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
      for (const [source, target] of logos) {
        const cell = source < 0 ? target : source
        const [column, row] =
          logoPosition(source, target, progress, data.columns)
        const opacity = source < 0 ? progress : 1

        context.globalAlpha = target < 0 ? 1 - progress : opacity
        if (!context.globalAlpha) {
          continue
        }
        const gap = (cellSize - sprite.width) / 2

        context.drawImage(sprite,
          (column + (physics[cell * 4] ?? 0)) * cellSize + gap,
          (row + (physics[cell * 4 + 1] ?? 0)) * cellSize + gap)
      }
      context.globalAlpha = 1
      lastFrame = frame
    }
    requestDraw()
  }
  const resize = () => {
    const width = canvas.getBoundingClientRect().width

    if (!width) {
      return
    }
    canvas.width = Math.round(width * Math.min(devicePixelRatio, 2))
    canvas.height = Math.round(canvas.width * data.rows / data.columns)
    cellSize = canvas.width / data.columns
    sprite.width = Math.max(1, Math.round(cellSize * 0.9))
    sprite.height = sprite.width
    spriteContext.drawImage(logo, 0, 0, sprite.width, sprite.height)
    lastFrame = -1
    requestDraw()
  }

  canvas.addEventListener('click', (event) => {
    if (reducedMotion.matches) {
      return
    }
    const bounds = canvas.getBoundingClientRect()
    const clickX = (event.clientX - bounds.left) / bounds.width * data.columns
    const clickY = (event.clientY - bounds.top) / bounds.height * data.rows
    const progress = time * data.fps % 1

    for (const [source, target] of logos) {
      const cell = source < 0 ? target : source
      const [column, row] = logoPosition(source, target, progress, data.columns)

      kickLogo(physics, cell, column, row, clickX, clickY)
    }
    requestDraw()
  }, { signal })
  canvas.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches) {
      return
    }
    const bounds = canvas.getBoundingClientRect()

    pointer.x = (event.clientX - bounds.left) / bounds.width * data.columns
    pointer.y = (event.clientY - bounds.top) / bounds.height * data.rows
    pointer.strength = 1
    lastFrame = -1
    requestDraw()
  }, { signal })
  canvas.addEventListener('pointerleave', () => {
    pointer.strength = 0
    requestDraw()
  }, { signal })
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(pending)
    pending = 0
    previous = performance.now()
    pointer.strength = 0
    lastFrame = -1
    requestDraw()
  }, { signal })
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      physics.fill(0)
      pointer.strength = 0
      lastFrame = -1
      requestDraw()
    }
  }, { signal })
  const observer = new ResizeObserver(resize)

  observer.observe(canvas)
  resize()
  return () => {
    observer.disconnect()
    cancelAnimationFrame(pending)
  }
}
