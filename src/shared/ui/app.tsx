import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import { useLayoutEffect } from 'preact/hooks'
import Router from 'preact-router'

import { useResource } from './hooks/async'
import { PageErrors } from './hooks/errors'
import type { PageRoute } from './routes'
import { pageRoutes } from './routes'

const Page = ({ page }: { path: string; page: PageRoute }) => {
  const { value: view } = useResource(page.load)

  useLayoutEffect(() => {
    if (!view) {
      return
    }
    document.documentElement.className = view.bodyClass
    document.body.className = view.bodyClass
    const defaultTitle = page.title === null ? '' : 'Censor Tracker'

    document.title = page.title ? getMessage(page.title) : defaultTitle
    document.documentElement.lang = getUILanguage()
    window.scrollTo(0, 0)
  }, [page, view])
  const View = view?.component

  return View ? <PageErrors key={page.path}><View /></PageErrors> : null
}

export const App = () => <Router>
  {pageRoutes.filter((page) => !page.firefox || browser.isFirefox)
    .map((page) => <Page key={page.path} path={page.path} page={page} />)}
</Router>
