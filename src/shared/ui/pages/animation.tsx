import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import { PageError } from '../components/page-error'
import styles from './animation/animation.module.scss'
import { mountAnimation } from './animation/player'

export const AnimationPage = () => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<unknown>(null)

  useLayoutEffect(() => {
    const controller = new AbortController()
    let cleanup: (() => void) | undefined

    mountAnimation(canvas.current!, controller.signal).then((dispose) => {
      if (controller.signal.aborted) {
        dispose()
      } else {
        cleanup = dispose
      }
    }).catch((error_) => {
      if (!controller.signal.aborted) {
        setError(error_)
      }
    })
    return () => {
      controller.abort()
      cleanup?.()
    }
  }, [])
  return <>
    <PageError error={error} />
    <main id="animationPlayer" class={styles.player}>
      <canvas id="animationCanvas" ref={canvas} class={styles.canvas} width="800" height="600" />
    </main>
  </>
}
