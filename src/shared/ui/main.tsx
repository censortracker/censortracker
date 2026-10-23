import './styles/fonts.scss'

import { initializeLanguage } from 'Background/i18n'
import { render } from 'preact'

import { App } from './app'
import { detach } from './hooks/async'

detach(initializeLanguage().then(() => render(<App />, document.body)))
