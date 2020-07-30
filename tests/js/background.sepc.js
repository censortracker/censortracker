import createDriver from '../selenium'

it('Some test', async () => {
  const browser = await createDriver()

  await browser.get('https://google.com/')
  await browser.quit()
}, 15000)
