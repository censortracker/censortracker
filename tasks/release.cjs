const fs = require('node:fs/promises')
const path = require('node:path')
const JSZip = require('jszip')

async function release(browser, variant = 'prod') {
  if (!['firefox', 'chrome'].includes(browser)) throw new Error('Expected firefox or chrome')
  if (variant !== 'prod' && !(browser === 'firefox' && variant === 'modern')) throw new Error('Invalid release variant')
  const source = require('./build-path.cjs')(browser, variant)
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json')))
  const messages = manifest.default_locale
    ? JSON.parse(await fs.readFile(path.join(source, '_locales', manifest.default_locale, 'messages.json')))
    : {}
  const name = manifest.name.replace(/__MSG_(\w+)__/g, (_, key) => messages[key].message)
    .toLowerCase().replace(/[^a-z0-9.-]+/g, '_')
  const zip = new JSZip()
  async function add(directory) {
    const entries = await fs.readdir(path.join(source, directory), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = path.posix.join(directory, entry.name)
      if (entry.isDirectory()) await add(name)
      else if (entry.isFile()) {
        zip.file(name, await fs.readFile(path.join(source, name)), {
          date: new Date('1980-01-01T00:00:00Z'), createFolders: false,
        })
      } else throw new Error(`Unsupported release entry: ${name}`)
    }
  }
  await add('')
  const destination = path.resolve('releases', variant === 'modern' ? 'firefox-modern' : browser)
  await fs.mkdir(destination, { recursive: true })
  const filename = path.join(destination, `${name}-${manifest.version}.zip`)
  await fs.writeFile(filename, await zip.generateAsync({
    type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS',
  }))
  console.log(filename)
}

release(process.argv[2], process.argv[3]).catch(error => {
  console.error(error)
  process.exitCode = 1
})
