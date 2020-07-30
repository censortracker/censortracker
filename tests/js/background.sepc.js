import buildDriver from '../selenium'

it('Some test', async () => {
  const browser = await buildDriver()

  await browser.get('https://google.com/')
  await browser.quit()
}, 15000)
