require('postcss-modules')
const FileSystemLoader = require('postcss-modules/build/FileSystemLoader').default
const { compileString } = require('sass')
const { pathToFileURL } = require('node:url')

// CSS Module dependencies bypass Vite's Sass preprocessor.
module.exports = class SassModuleLoader extends FileSystemLoader {
  constructor(root, plugins, resolve) {
    super(root, [{
      postcssPlugin: 'sass-module-values',
      Once(css, { postcss }) {
        const file = css.source.input.file
        if (!file.endsWith('.scss')) return
        const result = compileString(css.toString(), { url: pathToFileURL(file) })
        css.removeAll().append(postcss.parse(result.css, { from: file }).nodes)
      },
    }, ...plugins], resolve)
  }

  // The app imports shared styles once, before page rules. Keep only tokens here.
  get finalSource() { return '' }
}
