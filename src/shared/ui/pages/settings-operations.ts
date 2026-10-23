import { callBackground } from 'Background/background-rpc'

export const importSettings = async (file?: File) => {
  if (!file) {
    return
  }
  if (file.size > 32 * 1024 * 1024) {
    throw new Error('Settings file is too large')
  }
  await callBackground('restoreSettings', JSON.parse(await file.text()))
  window.location.reload()
}

export const exportFile = async (diagnostics: boolean) => {
  const data = diagnostics ? await callBackground('diagnosticInfo')
    : await callBackground('exportSettings')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  try {
    link.href = url
    link.download = `censortracker.${diagnostics ? 'diagnostics' : 'settings'}.json`
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
