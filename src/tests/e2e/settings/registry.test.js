import { waitFor } from '../utils'

describe('testing changes in registry', () => {
  let page
  let registryLink

  beforeAll(async () => {
    const extensionId = await global.getExtensionId()

    registryLink = `${global.extensionUrlPrefix}://${extensionId}/proxy-list.html`

    page = await global.getPage()

    // set timer to make sure that extension gets the registry
    await waitFor(5000)
    await page.goto(registryLink)

    await page.waitForSelector('.CodeMirror')

    await page.evaluate(() => {
      const codeMirrorInstance = document.querySelector('.CodeMirror')

      if (codeMirrorInstance) {
        const codeMirror = codeMirrorInstance.CodeMirror

        codeMirror.focus()
        codeMirror.setValue('')
        codeMirror.replaceSelection('github.com')
      }
    })

    await page.click('#saveChanges')
    await page.reload()
    await waitFor(2000)
  }, 60000)

  test('registry updates saved', async () => {
    await page.waitForSelector('.CodeMirror')

    const registryContent = await page.evaluate(() => {
      const codeMirrorInstance = document.querySelector('.CodeMirror')

      if (codeMirrorInstance) {
        return codeMirrorInstance.CodeMirror.getValue()
      }
      return undefined
    })

    expect(registryContent).toBe('github.com')
  })
})

describe('testing changes in ignored', () => {
  let page
  let ignoredLink

  beforeAll(async () => {
    const extensionId = await global.getExtensionId()

    ignoredLink = `${global.extensionUrlPrefix}://${extensionId}/ignore-list.html`
    page = await global.getPage()

    // set timer to make sure that extension gets the registry
    await waitFor(5000)
    await page.goto(ignoredLink)

    await page.waitForSelector('.CodeMirror')

    await page.evaluate(() => {
      const codeMirrorInstance = document.querySelector('.CodeMirror')

      if (codeMirrorInstance) {
        const codeMirror = codeMirrorInstance.CodeMirror

        codeMirror.focus()
        codeMirror.setValue('')
        codeMirror.replaceSelection('github.com')
      }
    })

    await page.click('#saveChanges')
    await page.reload()
    await waitFor(2000)
  }, 60000)

  test('ignored updates saved', async () => {
    await page.waitForSelector('.CodeMirror')

    const registryContent = await page.evaluate(() => {
      const codeMirrorInstance = document.querySelector('.CodeMirror')

      if (codeMirrorInstance) {
        return codeMirrorInstance.CodeMirror.getValue()
      }
      return undefined
    })

    expect(registryContent).toBe('github.com')
  })
})
