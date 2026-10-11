const path = require('node:path')

module.exports = async (entry, output) => {
  const { build } = await import('vite')
  await build({ configFile: false, publicDir: false, logLevel: 'error',
    resolve: { alias: { Background: path.resolve(__dirname, '../src/shared/js/background') } },
    build: { target: ['chrome108', 'firefox91'], outDir: output,
      lib: { entry, formats: ['iife'], name: 'Fixture', fileName: () => 'background.js' },
    },
  })
}
