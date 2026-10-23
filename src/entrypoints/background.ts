import { startBackground } from 'Background/background'
import { defineBackground } from 'wxt/utils/define-background'

export default defineBackground({
  persistent: true,
  main: startBackground,
})
