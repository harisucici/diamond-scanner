import { load } from 'cheerio'

export const PUBLIC_CATALOGS = {
  allu: { name: 'ALLU', table: 'allu_products', url: 'https://allu-official.com/jp/ja/market/b/c-83/', currency: 'JPY' },
  mejuri: { name: 'Mejuri', table: 'mejuri_products', url: 'https://mejuri.com/tw/en/collections/necklaces', currency: 'TWD' },
  rodeo: { name: 'Rodeo Drive', table: 'rodeo_products', url: 'https://www.rodeodrive.co.jp/shop/c~jewelry', currency: 'JPY', pages: 2 },
  watchnian: { name: 'WATCHNIAN', table: 'watchnian_products', url: 'https://watchnian.com/shop/r/rjewelry/?filtercode13=1', currency: 'JPY', pages: 2 }
}

export function parseCatalog(source, html) {
  const config = PUBLIC_CATALOGS[source]
  if (!config) throw new Error('Unknown catalog')
  const $ = load(html)
  const items = new Map()
  const cards = $({ allu: 'a[href*="/market/items/"]', mejuri: '[data-testid="product-card"]', rodeo: '.listitem', watchnian: '.block-thumbnail-t--goods' }[source])
  cards.each((_, element) => {
    const card = $(element)
    const linkSelector = { mejuri: 'a[aria-label][href*="/products/"]', rodeo: 'a.listitem_image', watchnian: 'a[href*="/shop/g/"]' }[source]
    const link = source === 'allu' ? card : card.find(linkSelector).first()
    const productName = source === 'allu' ? card.find('.p-productsSimilar__info__ttl').text().trim() : (source === 'mejuri' ? link.attr('aria-label') : link.attr('title'))?.trim()
    const priceText = card.find({ allu: '.p-productsSimilar__info__price', mejuri: '[data-testid="sale-price"]', rodeo: '.listitem_price strong', watchnian: '.block-thumbnail-t--price .num' }[source]).first().text()
    const price = Number(priceText.replace(/[^\d.]/g, ''))
    const href = link.attr('href')
    if (!productName || !href || !priceText.trim() || !Number.isFinite(price) || price <= 0) return
    const url = new URL(href, config.url)
    if (url.origin !== new URL(config.url).origin) return
    // Variants may repeat within a listing; retain each distinct displayed product.
    url.hash = ''
    // Product links contain the real image; the card may start with a condition icon.
    const imageElement = (source === 'rodeo' || source === 'watchnian' ? link : card).find('img').first()
    const image = imageElement.attr('data-src') || imageElement.attr('src')
    const condition = source === 'rodeo' ? (productName.match(/【([^】]+)】/)?.[1] || '') : source === 'watchnian' ? card.find('.block-thumbnail-t--conditions').text().replace(/\s+/g, ' ').trim() : ''
    items.set(url.href, {
      productName, price, currency: config.currency, url: url.href,
      imageUrl: image ? new URL(image, config.url).href : '',
      brand: source === 'mejuri' ? 'Mejuri' : inferAlluBrand(productName),
      condition,
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
  return brands.find(([label]) => name.replace(/\s+/g, '').includes(label))?.[1] || 'OTHER'
}

export function catalogPageUrl(source, page) {
  const url = new URL(PUBLIC_CATALOGS[source].url)
  if (page > 1) {
    if (source === 'rodeo' || source === 'watchnian') url.pathname = `${url.pathname.replace(/\/$/, '')}_p${page}/`
    else url.searchParams.set('page', page)
  }
  return url
}

export async function fetchPublicCatalog(source, { fetchImpl = fetch, pages = PUBLIC_CATALOGS[source]?.pages || (source === 'allu' ? 2 : 1) } = {}) {
  const config = PUBLIC_CATALOGS[source]
  if (!config) throw new Error('Unknown catalog')
  const unique = new Map()
  for (let page = 1; page <= pages; page++) {
    const url = catalogPageUrl(source, page)
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', 'Accept-Language': config.currency === 'JPY' ? 'ja-JP,ja;q=0.9' : 'en-US,en;q=0.9' },
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
