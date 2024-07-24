import { waitFor } from '../utils'

const registryLink = `chrome-extension://${global.extensionId}/proxy-list.html`
const ignoredLink = `chrome-extension://${global.extensionId}/ignore-list.html`

describe('testing changes in registry', () => {
  let page

  beforeAll(async () => {
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

  beforeAll(async () => {
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
