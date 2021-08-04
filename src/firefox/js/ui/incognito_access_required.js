import { extractDecodedOriginUrl, translateDocument } from '@/common/js'

(async () => {
  const originUrl = extractDecodedOriginUrl(window.location.href)

  translateDocument(document, { url: originUrl })
})()
