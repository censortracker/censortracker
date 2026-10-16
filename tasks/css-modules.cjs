// The package entry gives FileSystemLoader its file system.
require('postcss-modules')
const FileSystemLoader = require('postcss-modules/build/FileSystemLoader').default
const { readFileSync } = require('node:fs')
const { compileString } = require('sass')
const { pathToFileURL } = require('node:url')

// CSS Module dependencies bypass Vite's Sass preprocessor.
module.exports = class SassModuleLoader extends FileSystemLoader {
  constructor(root, plugins, resolve) {
    super(root, [{
      postcssPlugin: 'sass-module-values',
      Once(css, { postcss }) {
        const file = css.source?.input.file
        if (!file?.endsWith('.scss')) return
        const result = compileString(css.toString(), { url: pathToFileURL(file) })
        css.removeAll().append(postcss.parse(result.css, { from: file }).nodes)
      },
    }, ...plugins], resolve)
  }

  // valueImports emits each dependency once. Keep only names here.
  get finalSource() { return '' }
}

// Import the modules named by @value, so their CSS loads first with each page.
module.exports.valueImports = {
  name: 'css-module-value-imports',
  enforce: 'post',
  transform(code, id) {
    if (!id.endsWith('.module.scss')) return null
    const imports = [...readFileSync(id, 'utf8').matchAll(/^@value .+ from '(.+)';$/gm)]
      .map(([, file]) => `import ${JSON.stringify(file)}\n`)
    // Vite marks CSS Modules side-effect free; an import must keep their CSS.
    return { code: imports.join('') + code, map: null, moduleSideEffects: 'no-treeshake' }
  },
}
