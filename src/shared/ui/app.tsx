import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import { useLayoutEffect } from 'preact/hooks'
import Router from 'preact-router'

import { PageErrors } from './hooks/errors'
import type { PageRoute } from './routes'
import { pageRoutes } from './routes'

const Page = ({ page }: { path: string; page: PageRoute }) => {
  useLayoutEffect(() => {
    document.documentElement.className = page.bodyClass
    document.body.className = page.bodyClass
    const defaultTitle = page.title === null ? '' : 'Censor Tracker'

    document.title = page.title ? getMessage(page.title) : defaultTitle
    // Keep the native field fonts used by each original document language.
    document.documentElement.lang = page.language || 'ru'
    document.body.getBoundingClientRect()
    document.documentElement.lang = getUILanguage()
    window.scrollTo(0, 0)
  }, [page])
  const View = page.component

  return <PageErrors key={page.path}><View /></PageErrors>
}

export const App = () => <Router>
  {pageRoutes.filter((page) => !page.firefox || browser.isFirefox)
    .map((page) => <Page key={page.path} path={page.path} page={page} />)}
</Router>
