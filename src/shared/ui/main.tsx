import './styles/fonts.scss'
import './components/button.module.scss'
import './components/card.module.scss'
import './components/dialog.module.scss'
import './components/form.module.scss'
import './components/icons.module.scss'
import './components/layout.module.scss'
import './components/navigation-link.module.scss'
import './components/notice.module.scss'
import './components/popup-layout.module.scss'
import './pages/popup/info-block.module.scss'
import './styles/options.module.scss'
import './styles/popup.module.scss'
import './styles/consent.module.scss'

import { initializeLanguage } from 'Background/i18n'
import { render } from 'preact'

import { App } from './app'

initializeLanguage().then(() => render(<App />, document.body))
