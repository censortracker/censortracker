const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')

const inputs = ['src', 'public', 'tests/fixtures/manifests', 'tasks', 'package.json', 'package-lock.json', 'wxt.config.mjs', 'tsconfig.json', 'eslint.config.mjs', 'stylelint.config.mjs']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function hashes(directory, prefix = '') {
  const result = {}
  for (const name of (await fs.readdir(directory)).sort()) {
    const file = path.join(directory, name)
    const key = prefix + name
    if ((await fs.stat(file)).isDirectory()) Object.assign(result, await hashes(file, key + '/'))
    else result[key] = digest(await fs.readFile(file))
  }
  return result
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-reproducible-'))
  console.log(`Node ${process.version}; ${process.env.npm_config_user_agent || 'npm version unknown'}; logs: ${root}`)
  const results = []
  for (const [index, name] of ['first', 'different-path'].entries()) {
    const cwd = path.join(root, name)
    await fs.mkdir(cwd)
    for (const input of inputs) await fs.cp(path.resolve(input), path.join(cwd, input), { recursive: true })
    const env = { ...process.env, TZ: index ? 'Pacific/Honolulu' : 'UTC', LANG: index ? 'C' : 'en_US.UTF-8' }
    async function npm(args, log) {
      try {
        const result = await promisify(execFile)('npm', args, { cwd, env, maxBuffer: 16 * 1024 * 1024 })
        await fs.writeFile(path.join(cwd, log), result.stdout + result.stderr)
      } catch (error) {
        await fs.writeFile(path.join(cwd, log), (error.stdout || '') + (error.stderr || ''))
        throw error
      }
    }
    await npm(['ci', '--no-audit', '--no-fund'], 'install.log')
    const browsers = index ? ['chrome:prod', 'firefox:prod', 'firefox:modern'] : ['firefox:modern', 'firefox:prod', 'chrome:prod']
    for (const build of browsers) {
      const [browser, variant] = build.split(':')
      const output = require('./build-path.cjs')(browser, variant, path.join(cwd, '.output'))
      await fs.mkdir(output, { recursive: true })
      await fs.writeFile(path.join(output, 'stale-file.txt'), 'Must not enter the release')
      await npm(['run', `build:${build}`], `${browser}-${variant}.log`)
      const expected = JSON.parse(await fs.readFile(path.join(cwd, 'tests/fixtures/manifests',
        (variant === 'modern' ? 'firefox-modern' : browser) + '.json')))
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, 'manifest.json'))), expected,
        'WXT must preserve the complete production manifest')
      await assert.rejects(fs.access(path.join(output, 'stale-file.txt')))
      // Archive contents must not depend on filesystem timestamps.
      for (const file of Object.keys(await hashes(output))) {
        await fs.utimes(path.join(output, file), 0, index ? 1700000000 : 1000000000)
      }
    }
    const legacy = await hashes(path.join(cwd, '.output/firefox-mv2'))
    const modern = await hashes(path.join(cwd, '.output/firefox-mv2-modern'))
    delete legacy['manifest.json']
    delete modern['manifest.json']
    assert.deepEqual(modern, legacy, 'Firefox variants must use the same extension code and assets')
    await npm(['run', 'release'], 'release.log')
    await npm(['run', 'release:firefox:modern'], 'release-modern.log')
    results.push({ files: await hashes(path.join(cwd, '.output')), archives: await hashes(path.join(cwd, 'releases')) })
  }
  for (const group of ['files', 'archives']) {
    const first = results[0][group], second = results[1][group]
    const differences = [...new Set([...Object.keys(first), ...Object.keys(second)])]
      .filter(name => first[name] !== second[name])
    assert.deepEqual(differences, [], `Different ${group}`)
    console.log(`${Object.keys(first).length} ${group}: byte-for-byte identical`)
  }
  for (const [name, hash] of Object.entries(results[0].archives)) console.log(`${hash}  ${name}`)
  await fs.rm(root, { recursive: true, force: true })
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
