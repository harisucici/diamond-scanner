import { load } from 'cheerio'

export const PUBLIC_CATALOGS = {
  allu: { name: 'ALLU', table: 'allu_products', url: 'https://allu-official.com/jp/ja/market/b/c-83/', currency: 'JPY' },
  mejuri: { name: 'Mejuri', table: 'mejuri_products', url: 'https://mejuri.com/tw/en/collections/necklaces', currency: 'TWD' }
}

export function parseCatalog(source, html) {
  const config = PUBLIC_CATALOGS[source]
  if (!config) throw new Error('Unknown catalog')
  const $ = load(html)
  const items = new Map()
  const cards = source === 'allu' ? $('a[href*="/market/items/"]') : $('[data-testid="product-card"]')
  cards.each((_, element) => {
    const card = $(element)
    const link = source === 'allu' ? card : card.find('a[aria-label][href*="/products/"]').first()
    const productName = source === 'allu' ? card.find('.p-productsSimilar__info__ttl').text().trim() : link.attr('aria-label')?.trim()
    const priceText = source === 'allu' ? card.find('.p-productsSimilar__info__price').text() : card.find('[data-testid="sale-price"]').first().text()
    const price = Number(priceText.replace(/[^\d.]/g, ''))
    const href = link.attr('href')
    if (!productName || !href || !priceText.trim() || !Number.isFinite(price) || price <= 0) return
    const url = new URL(href, config.url)
    if (url.origin !== new URL(config.url).origin) return
    // Variants may repeat within a listing; retain each distinct displayed product.
    url.hash = ''
    const image = card.find('img[src]').first().attr('src')
    items.set(url.href, {
      productName, price, currency: config.currency, url: url.href,
      imageUrl: image ? new URL(image, config.url).href : '',
      brand: source === 'mejuri' ? 'Mejuri' : inferAlluBrand(productName),
      condition: '',
    })
  })
  return [...items.values()].map((item, index) => ({ ...item, rank: index + 1 }))
}

function inferAlluBrand(name) {
  const brands = [
    ['ヴァンクリーフ', 'Van Cleef & Arpels'], ['カルティエ', 'Cartier'],
    ['ティファニー', 'Tiffany & Co.'], ['ブルガリ', 'Bvlgari'],
    ['シャネル', 'Chanel'], ['エルメス', 'Hermès'], ['グッチ', 'Gucci'],
    ['タサキ', 'Tasaki'], ['ミキモト', 'Mikimoto'], ['ブシュロン', 'Boucheron']
  ]
  return brands.find(([label]) => name.includes(label))?.[1] || 'OTHER'
}

export async function fetchPublicCatalog(source, { fetchImpl = fetch, pages = source === 'allu' ? 2 : 1 } = {}) {
  const config = PUBLIC_CATALOGS[source]
  if (!config) throw new Error('Unknown catalog')
  const unique = new Map()
  for (let page = 1; page <= pages; page++) {
    const url = new URL(config.url)
    if (page > 1) url.searchParams.set('page', page)
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', 'Accept-Language': source === 'allu' ? 'ja-JP,ja;q=0.9' : 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(25000)
    })
    if (!response.ok) throw new Error(`${config.name}: HTTP ${response.status}，保留已有数据`)
    // Prevent a geo redirect from silently labeling another currency as TWD/JPY.
    if (response.url && (new URL(response.url).origin !== url.origin || (source === 'mejuri' && !new URL(response.url).pathname.startsWith('/tw/en/')))) {
      throw new Error(`${config.name}: 地区跳转，请确认币种后重试`)
    }
    const items = parseCatalog(source, await response.text())
    if (!items.length) throw new Error(`${config.name}: 未解析到商品，保留已有数据`)
    items.forEach(item => unique.set(item.url, item))
  }
  return { items: [...unique.values()].map((item, index) => ({ ...item, rank: index + 1 })), source }
}
