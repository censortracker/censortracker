const path = require('node:path')

module.exports = (browser, variant = 'prod', root = '.output') => path.resolve(root,
  `${browser}-mv${browser === 'firefox' ? 2 : 3}${variant === 'prod' ? '' : '-' + variant}`)
