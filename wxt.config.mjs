import preact from '@preact/preset-vite'
import cssnano from 'cssnano'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'wxt'

import { browserTargets, extensionManifest } from './src/manifest.ts'

const SassModuleLoader = createRequire(import.meta.url)('./tasks/css-modules.cjs')

export default defineConfig({
  srcDir: 'src',
  imports: false,
  alias: { Background: resolve('src/shared/js/background') },
  outDirTemplate: process.env.CT_FIREFOX_MODERN === '1'
    ? '{{browser}}-mv{{manifestVersion}}-modern' : undefined,
  manifest: ({ browser, command }) => extensionManifest(browser,
    process.env.CT_FIREFOX_MODERN === '1', command === 'serve'),
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      for (const language of ['en', 'ru', 'uk']) {
        files.push({
          absoluteSrc: resolve('src/locales', language, 'messages.json'),
          relativeDest: `_locales/${language}/messages.json`,
        })
      }
    },
    'build:manifestGenerated': (_wxt, manifest) => {
      // Keep the pre-WXT manifest shape. Browsers accept a string author.
      manifest.author = '__MSG_appAuthor__'
      delete manifest.browser_action?.default_title
      if (manifest.action) {
        delete manifest.action.default_title
        manifest.action.default_name = 'Censor Tracker'
      }
    },
  },
  vite: ({ mode }) => ({
    plugins: [preact({ devToolsEnabled: false }), SassModuleLoader.valueImports],
    build: {
      target: browserTargets,
      minify: 'terser',
      cssMinify: false,
      // PAC functions are serialized at runtime. Keep their local definitions.
      terserOptions: { compress: { inline: false, reduce_funcs: false } },
    },
    css: {
      postcss: { plugins: mode === 'production' ? [cssnano()] : [] },
      modules: {
        generateScopedName: '[name]__[local]__[hash:base64:6]',
        Loader: SassModuleLoader,
      },
    },
  }),
})
