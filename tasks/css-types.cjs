// Write a .d.ts with the exact class names of each CSS Module.
const { existsSync, readdirSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const postcss = require('postcss')
const modules = require('postcss-modules')
const { compile } = require('sass')
const Loader = require('./css-modules.cjs')

const root = join(__dirname, '../src')
const all = readdirSync(root, { recursive: true }).map((file) => join(root, file))
const files = all.filter((file) => file.endsWith('.module.scss'))
// Remove types of moved or deleted modules.
for (const file of all) {
  if (file.endsWith('.module.scss.d.ts') && !existsSync(file.slice(0, -5))) rmSync(file)
}

const key = (name) => /^[a-z_]\w*$/i.test(name) ? name : `'${name}'`
const types = (names) => [
  'declare const styles: {',
  ...names.map((name) => `  readonly ${key(name)}: string`),
  '}',
  '',
  'export default styles',
  '',
].join('\n')

Promise.all(files.map(async (file) => {
  let names = []
  const getJSON = (_, json) => { names = Object.keys(json).sort() }
  await postcss([modules({ Loader, getJSON })])
    .process(compile(file).css, { from: file })
  writeFileSync(`${file}.d.ts`, types(names))
})).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
