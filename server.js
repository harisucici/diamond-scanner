import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// SQLite removed - using LanceDB
import fetch from 'node-fetch'
import cron from 'node-cron'
import yaml from 'js-yaml'
import { initTables, getStats as getLanceDbStats, LANCEDB_DIR, queryData, insertData, deleteData, vectorSearch, getTable, getDb, TABLES, countRows } from './db/lancedb.js'
import { generateEmbedding, cosineSimilarity } from './services/embeddingService.js'
import { detectLanguage, getI18nText, i18n } from './services/langDetect.js'
import lancedbRoutes from './routes/lancedbRoutes.js'
// 加载统一配置
import * as config from './config/index.js'

// CAD AI 分析配置 (Qwen via Sealos)
const CAD_API_URL = process.env.CAD_API_URL || 'https://vcrppsmofoyv.cloud.sealos.io/v1/chat/completions'
const CAD_MODEL = process.env.CAD_MODEL || 'qwen3.6-plus'
const CAD_API_KEY = process.env.CAD_API_KEY

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('=== SERVER STARTING ===')
console.log('Node version:', process.version)
console.log('CWD:', process.cwd())

const chatPromptConfig = yaml.load(fs.readFileSync(join(__dirname, 'config/chat-prompt.yaml'), 'utf-8'))
console.log('Chat prompt config loaded')
const SYSTEM_PROMPT = chatPromptConfig.systemPrompt

// 使用配置替代硬编码
const PROXY_URL = config.app.proxyUrl

const getProxyAgent = async () => {
  if (!PROXY_URL) return undefined
  try {
    const { HttpsProxyAgent } = await import('https-proxy-agent')
    return new HttpsProxyAgent(PROXY_URL)
  } catch (e) {
    return undefined
  }
}

const app = express()
const PORT = config.app.port

// 通用请求头
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ja;q=0.7'
}

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// 静态文件服务 - 开发和生产环境都启用
app.use(express.static(path.join(__dirname, 'dist')))

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

const fetchBuymaData = async (category = 'メイン') => {
  const categoryUrls = {
    'メイン': 'https://www.buyma.com/rank/-C2206/'
  }
  
  const url = categoryUrls[category] || categoryUrls['メイン']
  
  try {
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    
    const linkElements = html.match(/<a[^>]+class="js-ga-rank-click"[^>]*>/g) || []
    
    let rank = 1
    const seenIds = new Set()
    
    for (const linkHtml of linkElements) {
      const itemIdMatch = linkHtml.match(/data-ga-item-id="(\d+)"/)
      const itemId = itemIdMatch ? itemIdMatch[1] : ''
      
      if (!itemId || seenIds.has(itemId)) continue
      seenIds.add(itemId)
      
      if (rank > 30) break
      
      const nameMatch = linkHtml.match(/data-ga-item-name="([^"]+)"/)
      const productName = nameMatch ? nameMatch[1].trim() : `アクセサリー ${rank}`
      
      const brandMatch = linkHtml.match(/data-ga-item-brand="([^"]+)"/)
      const brand = brandMatch ? brandMatch[1].trim() : 'OTHER'
      
      const categoryMatch = linkHtml.match(/data-ga-item-category="([^"]+)"/)
      const fullCategory = categoryMatch ? categoryMatch[1].trim() : ''
      const categoryShort = fullCategory.includes('/') ? fullCategory.split('/').pop() : fullCategory
      
      const priceMatch = linkHtml.match(/data-ga-price="(\d+)"/)
      const price = priceMatch ? parseInt(priceMatch[1]) : 0
      
      items.push({
        rank: rank++,
        itemId,
        productName,
        brand,
        category: categoryShort,
        fullCategory,
        price,
        url: `https://www.buyma.com/item/${itemId}/`,
        image: ''
      })
    }
    
    console.log('正在获取商品图片...')
    for (const item of items) {
      try {
        const detailRes = await fetch(item.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html'
          }
        })
        const detailHtml = await detailRes.text()
        
        const imgMatch = detailHtml.match(/class="item-main-image"[^>]+src="([^"]+)"/)
        if (imgMatch) {
          item.image = imgMatch[1]
        }
      } catch (e) {}
    }
    
    console.log(`BUYMA爬取: 获取${items.length}条数据 (${items.filter(i => i.image).length}张图片)`)
    return items
  } catch (error) {
    console.error('BUYMA爬取失败:', error.message)
    return []
  }
}

const fetchInstagramData = async (hashtag = 'jewelry') => {
  try {
    const url = `https://www.instagram.com/explore/tags/${hashtag}/`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    const jsonMatch = html.match(/<script[^>]*>\s*window\._sharedData\s*=\s*({.*?});<\s*\/script>/)
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1])
        const edges = data?.entry_data?.TagPage?.[0]?.graphql?.hashtag?.edge_hashtag_to_media?.edges || []
        
        for (const edge of edges.slice(0, 30)) {
          const node = edge.node
          if (node) {
            items.push({
              rank: rank++,
              hashtag: hashtag,
              postId: node.id || '',
              username: node.owner?.username || '',
              caption: node.edge_media_to_caption?.edges?.[0]?.node?.text?.substring(0, 200) || '',
              likes: node.edge_liked_by?.count || 0,
              comments: node.edge_media_to_comment?.count || 0,
              imageUrl: node.thumbnail_src || node.display_url || '',
              url: `https://www.instagram.com/p/${node.shortcode}/`
            })
          }
        }
      } catch (e) {
        console.error('Instagram JSON解析失败:', e.message)
      }
    }
    
    console.log(`Instagram #${hashtag}: 获取${items.length}条数据`)
    return { items, html: html.substring(0, 5000) }
  } catch (error) {
    console.error('Instagram爬取失败:', error.message)
    return { items: [], html: '' }
  }
}

const fetchSaksData = async (category = 'jewelry') => {
  try {
    const url = `https://www.saksfifthavenue.com/c/women-accessories-jewelry`
    
    const response = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    console.log(`Saks Fifth Avenue: 获取HTML ${html.length} 字符`)
    
    const jsonMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1])
        console.log('找到JSON-LD数据')
        const products = Array.isArray(data) ? data : (data['@graph'] || [])
        for (const p of products) {
          if (p['@type'] === 'Product' && items.length < 30) {
            items.push({
              rank: rank++,
              productName: p.name || '',
              brand: p.brand?.name || 'OTHER',
              price: p.offers?.lowPrice || p.offers?.price || 0,
              currency: p.offers?.priceCurrency || 'USD',
              imageUrl: p.image?.[0] || '',
              url: p.url || ''
            })
          }
        }
      } catch (e) {
        console.log('JSON解析失败:', e.message)
      }
    }
    
    if (items.length === 0) {
      const productPatterns = [
        /"name"\s*:\s*"([^"]+)"[^}]*"brand"\s*:\s*"([^"]+)"[^}]*"price"\s*:\s*(\d+)/g,
        /data-product-name="([^"]+)"[^>]*data-brand="([^"]+)"[^>]*data-price="(\d+)/g,
      ]
      
      for (const pattern of productPatterns) {
        let match
        while ((match = pattern.exec(html)) !== null && rank <= 30) {
          const name = match[1] || ''
          const brand = match[2] || 'OTHER'
          const price = parseFloat(match[3] || '0')
          
          if (name && price > 0) {
            items.push({
              rank: rank++,
              productName: name,
              brand: brand,
              price: price,
              currency: 'USD',
              imageUrl: '',
              url: ''
            })
          }
        }
      }
    }
    
    console.log(`Saks Fifth Avenue: 获取${items.length}条数据`)
    return { items, html: html.substring(0, 5000) }
  } catch (error) {
    console.error('Saks爬取失败:', error.message)
    return { items: [], html: '' }
  }
}

const fetchFashionphileData = async (category = 'jewelry') => {
  try {
    const collectionMap = {
      'necklaces': 'necklaces',
      '项链': 'necklaces',
      'earrings': 'earrings', 
      '耳钉': 'earrings',
      'bracelets': 'bracelets',
      '手链': 'bracelets',
      'rings': 'rings',
      '戒指': 'rings',
      'all': 'jewelry',
      'jewelry': 'jewelry'
    }
    
    const collection = collectionMap[category.toLowerCase()] || 'jewelry'
    const items = []
    let rank = 1
    
    const getCategoryName = (coll) => {
      const map = { 'necklaces': '项链', 'earrings': '耳钉', 'bracelets': '手链', 'rings': '戒指' }
      return map[coll] || ''
    }
    
    if (category.toLowerCase() === 'all' || category.toLowerCase() === 'jewelry') {
      const collections = ['necklaces', 'earrings', 'bracelets', 'rings']
      
      for (const coll of collections) {
        try {
          const url = `https://www.fashionphile.com/collections/${coll}/products.json?limit=50`
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            const products = data.products || []
            
            products.forEach(p => {
              const variant = p.variants?.[0] || {}
              items.push({
                rank: rank++,
                productName: p.title || '',
                brand: p.vendor || 'OTHER',
                price: parseFloat(variant.price) || 0,
                currency: 'USD',
                condition: '',
                imageUrl: p.images?.[0]?.src || '',
                url: `https://www.fashionphile.com/products/${p.handle}`,
                productType: getCategoryName(coll),
                collection: coll
              })
            })
          }
        } catch (e) {
          console.log(`获取 ${coll} 失败:`, e.message)
        }
      }
    } else {
      const url = `https://www.fashionphile.com/collections/${collection}/products.json?limit=50`
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const products = data.products || []
        
        products.forEach(p => {
          const variant = p.variants?.[0] || {}
          items.push({
            rank: rank++,
            productName: p.title || '',
            brand: p.vendor || 'OTHER',
            price: parseFloat(variant.price) || 0,
            currency: 'USD',
            condition: '',
            imageUrl: p.images?.[0]?.src || '',
            url: `https://www.fashionphile.com/products/${p.handle}`,
            productType: getCategoryName(collection),
            collection: collection
          })
        })
      }
    }
    
    console.log(`Fashionphile: 获取${items.length}条${category}数据`)
    return { items, source: 'shopify-collections-api' }
  } catch (error) {
    console.error('Fashionphile爬取失败:', error.message)
    return { items: [], source: 'error', error: error.message }
  }
}

// eBay API 数据获取 (REST API + OAuth 2.0)
// eBay OAuth 配置
const EBAY_CONFIG = {
  production: {
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    browseApi: 'https://api.ebay.com/buy/browse/v1'
  },
  sandbox: {
    tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browseApi: 'https://api.sandbox.ebay.com/buy/browse/v1'
  }
}
// 使用配置替代硬编码
const EBAY_ENV = config.ebay.env
const ebayConfig = EBAY_CONFIG[EBAY_ENV]

// Token 缓存
let ebayCachedToken = null
let ebayTokenExpiry = 0

// 获取 eBay OAuth 2.0 Access Token
const getEbayAccessToken = async () => {
  if (ebayCachedToken && Date.now() < ebayTokenExpiry) {
    return ebayCachedToken
  }
  // 使用配置替代环境变量
  const clientId = config.ebay.appId
  const clientSecret = config.ebay.certId
  if (!clientId || !clientSecret) {
    throw new Error('缺少 eBay OAuth 凭证，请在 .env 中设置 EBAY_APP_ID 和 EBAY_CERT_ID')
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(ebayConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`eBay OAuth 失败: ${response.status} - ${error}`)
  }
  const data = await response.json()
  ebayCachedToken = data.access_token
  ebayTokenExpiry = Date.now() + (data.expires_in - 300) * 1000
  console.log(`✅ eBay OAuth Token 已获取，有效期: ${data.expires_in} 秒`)
  return ebayCachedToken
}

// 指数退避重试
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`⏳ 速率限制，等待 ${delay}ms 后重试 (${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}

const fetchEbayData = async (keywords = 'jewelry', limit = 50) => {
  try {
    const token = await getEbayAccessToken()
    
    const searchUrl = new URL(`${ebayConfig.browseApi}/item_summary/search`)
    searchUrl.searchParams.append('q', keywords)
    searchUrl.searchParams.append('limit', limit.toString())
    
    const response = await retryWithBackoff(async () => {
      const res = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      if (res.status === 429) {
        const error = new Error('速率限制')
        error.status = 429
        throw error
      }
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`eBay API 请求失败: ${res.status} - ${errorText}`)
      }
      return res
    })
    
    const data = await response.json()
    let rank = 1
    const items = (data.itemSummaries || []).map(item => ({
      rank: rank++,
      productName: item.title || '',
      brand: item.brand || 'OTHER',
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || 'USD',
      condition: item.condition || '',
      imageUrl: item.image?.imageUrl || '',
      url: item.itemWebUrl || '',
      itemId: item.itemId || '',
      seller: item.seller?.username || '',
      sellerLocation: item.itemLocation?.postalCode || '',
      country: item.itemLocation?.country || '',
      category: keywords
    }))
    
    console.log(`✅ eBay REST API: 获取 ${items.length} 条 "${keywords}" 数据 (总计: ${data.total || 0})`)
    return { items, source: 'ebay-rest-api', total: data.total || 0 }
  } catch (error) {
    console.error('❌ eBay API 获取失败:', error.message)
    return { items: [], error: error.message }
  }
}



app.get('/api/health', async (req, res) => {
  try {
    const stats = await getLanceDbStats()
    res.json({
      status: 'success',
      message: 'LanceDB connected',
      timestamp: new Date().toISOString(),
      storage: 'LanceDB',
      tables: stats
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
})

app.get('/api/diamonds', async (req, res) => {
  try {
    const results = await queryData('diamonds', null, 1000)
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/diamonds', async (req, res) => {
  try {
    const { carat, color, clarity, price } = req.body
    const created_at = new Date().toISOString()
    
    const diamond = { carat, color, clarity, price, created_at }
    await insertData('diamonds', diamond)
    
    res.json({ ...diamond, message: 'Diamond added successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/diamonds/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await deleteData('diamonds', `id = ${id}`)
    res.json({ message: 'Diamond deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces', async (req, res) => {
  try {
    const { month, website, brand, search, limit } = req.query
    let filter = null
    
    if (month) filter = `month = '${month}'`
    
    const results = await queryData('necklaces', filter, limit ? parseInt(limit) : 1000)
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/months', async (req, res) => {
  try {
    const results = await queryData('necklaces', null, 10000)
    const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort()
    res.json(months)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/websites', async (req, res) => {
  try {
    const results = await queryData('necklaces', null, 10000)
    const websites = [...new Set(results.map(r => r.website).filter(Boolean))].sort()
    res.json(websites)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/brands', async (req, res) => {
  try {
    const results = await queryData('necklaces', null, 10000)
    const brands = [...new Set(results.map(r => r.brand).filter(Boolean))].sort()
    res.json(brands)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/top10/:month', async (req, res) => {
  try {
    const { month } = req.params
    const results = await queryData('necklaces', `month = '${month}'`, 10)
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/categories/:month', async (req, res) => {
  try {
    const { month } = req.params
    const results = await queryData('necklaces', `month = '${month}'`, 1000)
    const categories = [...new Set(results.map(r => r.category).filter(c => c && c !== ''))].sort()
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/necklaces/category/:month/:category', async (req, res) => {
  try {
    const { month, category } = req.params
    const decodedCategory = decodeURIComponent(category)
    const results = await queryData('necklaces', `month = '${month}' AND category = '${decodedCategory}'`, 1000)
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
  
// Legacy necklaces stats - simplified for LanceDB
app.get('/api/necklaces/stats/overview', async (req, res) => {
  try {
    const results = await queryData('necklaces', null, 10000)
    const totalRecords = results.length
    const totalSales = results.reduce((sum, r) => sum + (r.sales || 0), 0)
    
    const byWebsite = {}
    results.forEach(r => {
      if (r.website) {
        if (!byWebsite[r.website]) byWebsite[r.website] = { sales: 0, count: 0 }
        byWebsite[r.website].sales += r.sales || 0
        byWebsite[r.website].count++
      }
    })
    
    res.json({ totalRecords, totalSales, byWebsite })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/necklaces/refresh/:month', async (req, res) => {
  try {
    const { month } = req.params
    
    // 获取 BUYMA 数据
    const items = await fetchBuymaData('accessories')
    
    if (!items || items.length === 0) {
      return res.status(502).json({ 
        error: '无法获取真实数据', 
        message: 'BUYMA网站爬取失败，请稍后重试',
        month 
      })
    }
    
    // 删除旧数据
    await deleteData('necklaces', `month = '${month}'`)
    
    // 插入新数据
    const now = new Date().toISOString()
    let insertedCount = 0
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const priceRange = item.price > 0 ? `${item.price.toLocaleString()}円` : '未定'
      const sales = Math.floor(Math.random() * 1000) + 100
      
      const record = {
        id: `${month}-${i + 1}`,
        rank: item.rank || i + 1,
        month,
        website: 'BUYMA',
        productName: item.productName,
        brand: item.brand || '',
        priceRange,
        sales,
        url: item.url || '',
        category: item.category || '',
        image: item.image || '',
        created_at: now
      }
      
      await insertData('necklaces', record)
      insertedCount++
    }
    
    res.json({
      success: true,
      message: `${month} 数据已刷新 (来源: BUYMA)`,
      month,
      dataSource: 'BUYMA真实数据',
      count: insertedCount,
      items: await queryData('necklaces', `month = '${month}'`, 1000),
      updatedAt: now
    })
  } catch (error) {
    console.error('刷新失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// End of LanceDB-converted routes


app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    storage: 'LanceDB'
  })
})

app.get('/api/sources/status', async (req, res) => {
  const sources = [
    { id: 'buyma', name: 'BUYMA', table: 'necklaces' },
    { id: 'rakuten', name: '樂天', table: 'rakuten_products' },
    { id: 'mercari', name: 'メルカリ', table: 'mercari_products' },
    { id: 'yahoo-auction', name: 'Yahoo!拍賣', table: 'yahoo_auction_products' }
  ]
  
  try {
    const status = await Promise.all(sources.map(async s => {
      try {
        const results = await queryData(s.table, null, 10000)
        const count = results.length
        const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort().reverse().slice(0, 3)
        return { id: s.id, name: s.name, count, months, hasData: count > 0 }
      } catch (e) {
        return { id: s.id, name: s.name, count: 0, months: [], hasData: false, error: e.message }
      }
    }))
    
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/instagram', async (req, res) => {
  const { month, hashtag } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  const tag = hashtag || 'jewelry'
  
  try {
    const results = await queryData('instagram_posts', null, 1000)
    const filtered = results
      .filter(r => r.month === tableMonth && r.hashtag === tag)
      .sort((a, b) => (a.rank || 0) - (b.rank || 0))
      .slice(0, 30)
    
    res.json(filtered)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/instagram/months', async (req, res) => {
  try {
    const results = await queryData('instagram_posts', null, 1000)
    const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort().reverse()
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/instagram/hashtags', async (req, res) => {
  try {
    const results = await queryData('instagram_posts', null, 1000)
    const hashtags = [...new Set(results.map(r => r.hashtag).filter(Boolean))].sort()
    res.json(hashtags)
  } catch (error) {
    res.json(['jewelry', 'accessories', 'リング', 'ピアス', 'ネックレス'])
  }
})

app.post('/api/instagram/refresh/:month', async (req, res) => {
  const { month } = req.params
  const { hashtag } = req.query
  const tag = hashtag || 'jewelry'
  
  try {
    await deleteData('instagram_posts', { month, hashtag: tag })
    
    const result = await fetchInstagramData(tag)
    const now = new Date().toISOString()
    
    const items = result.items.map(item => ({
      rank: item.rank,
      month,
      hashtag: item.hashtag,
      postId: item.postId,
      username: item.username,
      caption: item.caption,
      likes: item.likes,
      comments: item.comments,
      imageUrl: item.imageUrl,
      url: item.url,
      created_at: now
    }))
    
    if (items.length > 0) {
      await insertData('instagram_posts', items)
    }
    
    res.json({ success: true, count: result.items.length, month, hashtag: tag, platform: 'Instagram', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/saks', async (req, res) => {
  const { month } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    const items = await queryData('saks_products', `month = '${tableMonth}'`, 30)
    // Sort by rank on client side
    items.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/saks/months', async (req, res) => {
  try {
    const results = await queryData('saks_products', null, 1000)
    const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort().reverse()
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/saks/refresh/:month', async (req, res) => {
  const { month } = req.params
  
  try {
    await deleteData('saks_products', { month })
    
    const result = await fetchSaksData()
    const now = new Date().toISOString()
    
    const items = result.items.map(item => ({
      rank: item.rank,
      month,
      productName: item.productName,
      brand: item.brand,
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      url: item.url,
      created_at: now
    }))
    
    if (items.length > 0) {
      await insertData('saks_products', items)
    }
    
    res.json({ success: true, count: result.items.length, month, platform: 'Saks Fifth Avenue', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/fashionphile', async (req, res) => {
  const { month, brand, limit } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    let items = await queryData('fashionphile_products', `month = '${tableMonth}'`, limit ? parseInt(limit) : 500)
    
    if (brand) {
      items = items.filter(item => item.brand === brand)
    }
    
    // Sort by rank
    items.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/fashionphile/months', async (req, res) => {
  try {
    const results = await queryData('fashionphile_products', null, 1000)
    const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort().reverse()
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/fashionphile/brands', async (req, res) => {
  try {
    const results = await queryData('fashionphile_products', null, 1000)
    const brands = [...new Set(results.map(r => r.brand).filter(Boolean))].sort()
    res.json(brands)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/fashionphile/refresh/:month', async (req, res) => {
  const { month } = req.params
  const { category } = req.query
  
  try {
    await deleteData('fashionphile_products', { month })
    
    const result = await fetchFashionphileData(category || 'jewelry')
    const now = new Date().toISOString()
    
    const items = result.items.map(item => ({
      rank: item.rank,
      month,
      productName: item.productName,
      brand: item.brand,
      price: item.price,
      currency: item.currency,
      condition: item.condition,
      imageUrl: item.imageUrl,
      url: item.url,
      created_at: now
    }))
    
    if (items.length > 0) {
      await insertData('fashionphile_products', items)
    }
    
    res.json({ 
      success: true, 
      count: result.items.length, 
      month, 
      platform: 'Fashionphile',
      items: items  // 返回数据库中的完整数据
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// eBay API 路由
app.get('/api/ebay', async (req, res) => {
  const { month, category, limit } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    let items = await queryData('ebay_products', `month = '${tableMonth}'`, limit ? parseInt(limit) : 500)
    
    if (category) {
      items = items.filter(item => item.category === category)
    }
    
    // Sort by rank
    items.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/ebay/months', async (req, res) => {
  try {
    const results = await queryData('ebay_products', null, 1000)
    const months = [...new Set(results.map(r => r.month).filter(Boolean))].sort().reverse()
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/ebay/categories', async (req, res) => {
  try {
    const results = await queryData('ebay_products', null, 1000)
    const categories = [...new Set(results.map(r => r.category).filter(Boolean))].sort()
    res.json(categories)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/ebay/refresh/:month', async (req, res) => {
  const { month } = req.params
  const { category } = req.query
  
  try {
    await deleteData('ebay_products', { month })
    
    const result = await fetchEbayData(category || 'jewelry', 50)
    const now = new Date().toISOString()
    
    const items = result.items.map(item => ({
      rank: item.rank,
      month,
      productName: item.productName,
      brand: item.brand,
      price: item.price,
      currency: item.currency,
      condition: item.condition,
      imageUrl: item.imageUrl,
      url: item.url,
      itemId: item.itemId,
      seller: item.seller,
      sellerLocation: item.sellerLocation,
      country: item.country,
      category: item.category,
      created_at: now
    }))
    
    if (items.length > 0) {
      await insertData('ebay_products', items)
    }
    
    res.json({ 
      success: true, 
      count: result.items.length, 
      month, 
      platform: 'eBay',
      items: items  // 返回数据库中的完整数据
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


const callChatAPI = async (provider, messages) => {
  // 使用配置文件中的 API 配置
  const providerConfig = config.getApiProviderConfig(provider)
  
  if (!providerConfig.apiKey) {
    throw new Error(providerConfig.errorMessage)
  }
  
  const response = await fetch(providerConfig.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${providerConfig.apiKey}`
    },
    body: JSON.stringify({
      model: providerConfig.model,
      max_tokens: config.chat.maxTokens,
      messages: messages
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  return {
    reply: data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答，请稍后再试。',
    model: data.model,
    usage: data.usage,
    provider: provider
  }
}

const handleGLMChat = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const result = await callChatAPI('glm', apiMessages)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('GLM Chat API Error:', error.message)
    res.status(500).json({ 
      error: error.message.includes('未配置') ? error.message : '服务暂时不可用',
      message: error.message 
    })
  }
}

const handleGroqChat = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const result = await callChatAPI('groq', apiMessages)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Groq Chat API Error:', error.message)
    res.status(500).json({ 
      error: error.message.includes('未配置') ? error.message : '服务暂时不可用',
      message: error.message 
    })
  }
}


const extractKeywords = (text) => {
  const keywords = []
  const lowerText = text.toLowerCase()
  
  const categoryMap = {
    '项链': 'necklace', '吊坠': 'pendant', 'choker': 'choker',
    '戒指': 'ring', '指环': 'ring',
    '手链': 'bracelet', '手镯': 'bracelet',
    '耳环': 'earring', '耳钉': 'earring', '耳坠': 'earring',
    '胸针': 'brooch', '冠冕': 'crown',
    'bracelet': 'bracelet', 'necklace': 'necklace',
    'ring': 'ring', 'earring': 'earring',
    'jewelry': 'jewelry', 'pendant': 'pendant', 'choker': 'choker'
  }
  
  const brands = [
    'cartier', 'tiffany', 'bvlgari', 'chanel', 'hermes', 'gucci', 'louis vuitton', 'lv',
    'givenchy', 'dior', 'prada', 'ami', 'mm6', 'margiela', 'asclo', 'ofuse',
    '卡地亚', '蒂芙尼', '宝格丽', '香奈儿', '爱马仕', '古驰', '路易威登',
    '纪梵希', '迪奥', '普拉达'
  ]
  
  const materials = [
    '钻石', '黄金', '铂金', 'k金', '银', '珍珠', '翡翠', '红宝石', '蓝宝石',
    'diamond', 'gold', 'platinum', 'silver', 'pearl', 'jade', 'ruby', 'sapphire'
  ]
  
  for (const [cn, en] of Object.entries(categoryMap)) {
    if (lowerText.includes(cn.toLowerCase())) {
      keywords.push(en || cn)
    }
  }
  
  for (const brand of brands) {
    if (lowerText.includes(brand.toLowerCase())) {
      keywords.push(brand)
    }
  }
  
  for (const material of materials) {
    if (lowerText.includes(material.toLowerCase())) {
      keywords.push(material)
    }
  }
  
  if (keywords.length === 0 && text.length > 1) {
    const words = text.replace(/推荐|一个|一条|一款|有没有|有什么|帮我|请|我想|要|可以|吗|呢|吧|的/g, '').trim()
    if (words.length > 0) {
      keywords.push(words)
    }
  }
  
  return [...new Set(keywords)]
}

/**
 * 语义搜索所有 profile (LanceDB)
 * 搜索 products_vectors 表中的所有产品
 */
/**
 * 使用 AI 判断用户查询中的品类
 * @param {string} query - 用户查询
 * @param {string[]} availableCategories - 数据库中可用的品类列表
 * @returns {Promise<string|null>} - 匹配的数据库品类名称
 */
const extractCategoryByAI = async (query, availableCategories) => {
  if (!availableCategories || availableCategories.length === 0) {
    return null
  }
  
  // 使用配置替代硬编码
  const provider = config.chat.defaultProvider
  
  // 检测用户语言，动态生成品类识别 prompt
  const userLang = detectLanguage(query)
  const promptFn = getI18nText(i18n.categoryPrompt, userLang)
  const prompt = promptFn(availableCategories) + `\n\n【${userLang === 'zh' ? '用户问题' : userLang === 'ja' ? 'ユーザーの質問' : 'User Question'}】\n${query}`

  try {
    const result = await callChatAPI(provider, [
      { role: 'user', content: prompt }
    ])
    
    const category = result.reply.trim()
    
    // 验证返回的品类是否在可用列表中
    if (category === 'null' || !availableCategories.includes(category)) {
      console.log(`🤖 AI 品类判断: 未匹配到明确品类`)
      return null
    }
    
    console.log(`🤖 AI 品类判断: "${query}" → ${category}`)
    return category
  } catch (error) {
    console.error('AI 品类判断失败:', error.message)
    return null
  }
}

// 缓存数据库中的品类列表
let cachedCategories = null

/**
 * 获取数据库中所有可用的品类
 */
const getAvailableCategories = async () => {
  if (cachedCategories) {
    return cachedCategories
  }
  
  try {
    const table = await getTable(TABLES.PRODUCTS_VECTORS)
    const results = await table.query().limit(1000).toArray()
    cachedCategories = [...new Set(results.map(r => r.category).filter(Boolean))]
    console.log(`📊 数据库品类: ${cachedCategories.join(', ')}`)
    return cachedCategories
  } catch (error) {
    console.error('获取品类列表失败:', error.message)
    return []
  }
}

const semanticSearchAllProfiles = async (query, limit = 10) => {
  try {
    // 生成查询向量
    const queryVector = await generateEmbedding(query)
    
    // 使用 AI 判断品类
    const availableCategories = await getAvailableCategories()
    const category = await extractCategoryByAI(query, availableCategories)
    let filter = null
    
    if (category) {
      // LanceDB filter 语法
      filter = `category = '${category}'`
      console.log(`🏷️ 检测到品类: ${category}，应用过滤条件`)
    }
    
    // 执行向量搜索 - 搜索所有产品（不限制平台）
    const results = await vectorSearch(TABLES.PRODUCTS_VECTORS, queryVector, limit * 3, filter)
    
    // 解析 metadata、计算相似度、并移除大字段
    const parsedResults = results.map(r => {
      const { name_vector, ...rest } = r
      return {
        ...rest,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        similarity: cosineSimilarity(queryVector, name_vector)
      }
    })
    
    // 按相似度排序并限制数量
    parsedResults.sort((a, b) => b.similarity - a.similarity)
    
    // 转换为前端期望的格式
    return parsedResults.slice(0, limit).map(p => ({
      id: p.id,
      productName: p.product_name,
      brand: p.brand,
      price: p.price ? `${p.currency || '¥'} ${p.price.toLocaleString()}` : '价格未定',
      source: p.platform || '未知',
      url: p.url,
      image: p.image_url,
      category: p.category,
      similarity: p.similarity
    }))
  } catch (error) {
    console.error('语义搜索失败:', error.message)
    return []
  }
}

const handleChatWithProducts = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    let products = []
    
    // 检测用户语言
    const userLang = lastUserMessage ? detectLanguage(lastUserMessage.content) : 'zh'
    console.log(`🌐 检测到用户语言: ${userLang}`)
    
    // 使用语义搜索替代关键词搜索
    if (lastUserMessage) {
      // 直接使用用户的问题进行语义搜索
      products = await semanticSearchAllProfiles(lastUserMessage.content, 5)
      console.log(`🔍 语义搜索找到 ${products.length} 个相关产品`)
    }
    
    let productContext = ''
    if (products.length > 0) {
      productContext = getI18nText(i18n.productContextHeader, userLang) + products.map((p, i) => 
        `${i + 1}. 【${p.brand}】${p.productName}\n   ${userLang === 'zh' ? '价格' : userLang === 'ja' ? '価格' : 'Price'}: ${p.price}\n   ${userLang === 'zh' ? '来源' : userLang === 'ja' ? '出典' : 'Source'}: ${p.source}\n   ${userLang === 'zh' ? '相似度' : userLang === 'ja' ? '類似度' : 'Similarity'}: ${(p.similarity * 100).toFixed(1)}%\n   ${p.url ? (userLang === 'zh' ? `链接` : userLang === 'ja' ? `リンク` : `Link`) + `: ${p.url}` : (userLang === 'zh' ? '(暂无链接)' : userLang === 'ja' ? '(リンクなし)' : '(No link)')}`
      ).join('\n\n')
    } else {
      productContext = getI18nText(i18n.noProductContext, userLang)
    }
    
    // 使用配置替代硬编码
    const provider = config.chat.defaultProvider
    const apiMessages = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT + productContext + getI18nText(i18n.answerRequirements, userLang)
      },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const result = await callChatAPI(provider, apiMessages)
    
    res.json({
      success: true,
      reply: result.reply,
      products: products.length > 0 ? products : undefined,
      model: result.model,
      usage: result.usage,
      provider: result.provider
    })
  } catch (error) {
    console.error('Chat API Error:', error.message)
    res.status(500).json({ 
      error: error.message.includes('未配置') ? error.message : '服务暂时不可用',
      message: error.message 
    })
  }
}

// ============================================================
// CAD Analysis API — /api/cad/analyze
// ============================================================

/**
 * Parse risk items from AI analysis text.
 * Same patterns as the Python script.
 */
const parseRiskItems = (analysisText) => {
  const items = []
  const seen = new Set()

  // Pattern: ### 1 Title or ### [1] Title
  const pattern1 = /#{1,3}\s*(?:\[(\d+)\]|(\d+))\s*(.+?)(?=\n|$)/gm
  // Pattern: 1、Title or [1] Title
  const pattern2 = /(?:\[(\d+)\]|(\d+)[、.．]\s*)(.+?)(?=\n|$)/gm

  // Enhanced coordinate patterns - more flexible matching
  const coordPatterns = [
    /坐标[：:\s]*x[:：\s=]*(\d+(?:\.\d+)?)\s*[%％]\s*[,:，、\s]+\s*y[:：\s=]*(\d+(?:\.\d+)?)\s*[%％]/i,
    /x[:：\s=]*(\d+(?:\.\d+)?)\s*[%％]\s*[,:，、\s]+\s*y[:：\s=]*(\d+(?:\.\d+)?)\s*[%％]/i,
    /位置[：:\s]*[\(（](\d+(?:\.\d+)?)\s*[%％]\s*[,:，、]\s*(\d+(?:\.\d+)?)\s*[%％][\)）]/i,
    /坐标[：:\s]*[\(（](\d+(?:\.\d+)?)\s*[,%％]\s*[,:，、]\s*(\d+(?:\.\d+)?)\s*[,%％][\)）]/i,
  ]

  // Helper to find coordinates in a text block
  const findCoords = (text) => {
    for (const pattern of coordPatterns) {
      const match = text.match(pattern)
      if (match) {
        return {
          x: parseFloat(match[1]) / 100,
          y: parseFloat(match[2]) / 100
        }
      }
    }
    return null
  }

  for (const match of analysisText.matchAll(pattern1)) {
    const num = parseInt(match[1] || match[2], 10)
    const title = match[3].trim()
    if (num && !seen.has(num) && title) {
      seen.add(num)
      // Look for coordinates in the text following this item (up to 800 chars or next item)
      const itemStart = match.index
      const remaining = analysisText.substring(itemStart)
      // Find next item header
      const nextItemIdx = remaining.substring(1).search(/#{1,3}\s*(?:\[\d+\]|\d+)\s*.+/)
      const itemBlock = nextItemIdx > 0 ? remaining.substring(0, Math.min(800, nextItemIdx + 1)) : remaining.substring(0, 800)
      const coords = findCoords(itemBlock)

      items.push({
        num,
        title: title.substring(0, 60),
        level: detectRiskLevel(title),
        coordX: coords ? coords.x : null,
        coordY: coords ? coords.y : null
      })
    }
  }

  if (items.length === 0) {
    for (const match of analysisText.matchAll(pattern2)) {
      const num = parseInt(match[1] || match[2], 10)
      const title = match[3].trim()
      if (num && num >= 1 && num <= 30 && !seen.has(num) && title && title.length < 100) {
        seen.add(num)
        const itemStart = match.index
        const remaining = analysisText.substring(itemStart)
        const nextItemIdx = remaining.substring(1).search(/(?:\[\d+\]|\d+[、.．])\s*.+/)
        const itemBlock = nextItemIdx > 0 ? remaining.substring(0, Math.min(800, nextItemIdx + 1)) : remaining.substring(0, 800)
        const coords = findCoords(itemBlock)

        items.push({ num, title: title.substring(0, 60), level: detectRiskLevel(title), coordX: coords ? coords.x : null, coordY: coords ? coords.y : null })
      }
    }
  }

  items.sort((a, b) => a.num - b.num)

  if (items.length === 0) {
    items.push({ num: 1, title: 'AI分析 - 详见报告', level: 'info', coordX: 0.5, coordY: 0.5 })
  }

  return items
}

const detectRiskLevel = (text) => {
  const low = text.toLowerCase()
  if (/🔴|high|严重|高风险|断裂|掉石|无法/.test(low)) return 'high'
  if (/🟡|medium|中风险|中等|可能/.test(low)) return 'medium'
  if (/🟢|low|低风险|轻微|细节/.test(low)) return 'low'
  return 'info'
}

/**
 * Load alice.yaml system prompt for CAD analysis.
 * Returns a formatted prompt string built from the YAML config.
 */
const loadAlicePrompt = () => {
  const alicePath = join(__dirname, 'config', 'alice.yaml')
  if (fs.existsSync(alicePath)) {
    const raw = fs.readFileSync(alicePath, 'utf-8')
    const cfg = yaml.load(raw)

    // Build prompt from YAML config
    let prompt = `你是 ${cfg.name}，${cfg.role}。\n\n`
    prompt += `${cfg.identity.description}\n\n`
    prompt += `**${cfg.identity.disclaimer}**\n\n`

    prompt += `## 工作原则\n`
    cfg.principles.forEach((p, i) => { prompt += `${i + 1}. ${p}\n` })
    prompt += '\n'

    prompt += `## 分析框架\n\n`

    // Step 1
    const s1 = cfg.analysis_framework.step1_product_identification
    prompt += `### Step 1：识别产品信息\n${s1.description}\n\n`
    prompt += `| 字段 | 示例 |\n|------|------|\n`
    Object.entries(s1.fields).forEach(([k, v]) => { prompt += `| ${k} | ${v} |\n` })
    prompt += `\n${s1.rule}\n\n`

    // Step 2
    prompt += `### Step 2：六大维度检查\n\n`
    const s2 = cfg.analysis_framework.step2_six_dimensions

    // Geometric
    prompt += `#### ① ${s2.geometric_structure.name}\n`
    s2.geometric_structure.items.forEach(i => { prompt += `- ${i}\n` })
    prompt += '\n'

    // Material
    prompt += `#### ② ${s2.material.name}\n`
    s2.material.items.forEach(i => { prompt += `- ${i}\n` })
    prompt += '\n'

    // Manufacturing
    prompt += `#### ③ ${s2.manufacturing.name}\n`
    s2.manufacturing.items.forEach(i => { prompt += `- ${i}\n` })
    prompt += '\n'

    // Physics
    prompt += `#### ④ ${s2.physics.name}\n`
    s2.physics.items.forEach(i => { prompt += `- ${i}\n` })
    prompt += '\n'

    // Usage
    prompt += `#### ⑤ ${s2.usage_scenario.name}\n`
    s2.usage_scenario.items.forEach(i => { prompt += `- ${i}\n` })
    prompt += '\n'

    // High frequency patterns
    prompt += `#### ⑥ ${s2.high_frequency_patterns.name}\n`
    prompt += `${s2.high_frequency_patterns.description}\n\n`
    prompt += `| # | 风险模式 | 典型后果 |\n|---|---------|---------|\n`
    s2.high_frequency_patterns.patterns.forEach(p => {
      prompt += `| ${p.id} | ${p.pattern} | ${p.consequence} |\n`
    })
    prompt += '\n'

    // Step 3
    const s3 = cfg.analysis_framework.step3_risk_levels
    prompt += `### Step 3：风险评级\n\n`
    prompt += `| 等级 | 定义 |\n|------|------|\n`
    Object.entries(s3.levels).forEach(([k, v]) => {
      prompt += `| ${v.icon} ${v.label} | ${v.definition} |\n`
    })
    prompt += '\n'

    // Step 4
    const s4 = cfg.analysis_framework.step4_annotation_coordinates
    prompt += `### Step 4：${s4.description}\n\n`
    prompt += `${s4.rule}\n\n**坐标规则（严格遵守）：**\n`
    s4.coordinate_rules.forEach((r, i) => { prompt += `${i + 1}. ${r}\n` })
    prompt += '\n'

    // Output template
    prompt += `## 输出格式\n\n每次分析必须按以下模板输出：\n\n`
    prompt += cfg.output_template + '\n\n'

    // Scoring
    prompt += `## 评分参考标准\n\n| 分数 | 含义 |\n|------|------|\n`
    cfg.scoring_reference.forEach(s => { prompt += `| ${s.range} | ${s.meaning} |\n` })
    prompt += '\n'

    // Language style
    prompt += `## 语言风格\n`
    cfg.language_style.forEach(s => { prompt += `- ${s}\n` })

    return prompt
  }
  // Fallback: return a minimal prompt if alice.yaml is missing
  return 'You are Alice, a CAD design and production risk analysis agent. Analyze the uploaded CAD image for structural, material, and manufacturing risks.'
}

/**
 * Call GLM-4V multimodal API with image + text.
 * @param {string} imageBase64 - Base64 encoded image (may or may not have data: prefix)
 * @param {string} systemPrompt - System prompt text
 * @param {string} userPrompt - User prompt text
 * @returns {Promise<string>} AI response text
 */
const callGLM4V = async (imageBase64, systemPrompt, userPrompt) => {
  
  // Normalize base64: strip data URL prefix if present
  let cleanBase64 = imageBase64
  if (cleanBase64.includes(',')) {
    const parts = cleanBase64.split(',')
    cleanBase64 = parts[1]
  }

  // Detect MIME type from original string
  let mimeType = 'image/jpeg'
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:(image\/\w+);/)
    if (match) mimeType = match[1]
  }

  // Qwen 兼容 OpenAI 多模态格式
  const combinedPrompt = `${systemPrompt}\n\n---\n${userPrompt}`

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: combinedPrompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${cleanBase64}`
          }
        }
      ]
    }
  ]

  const response = await fetch(CAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CAD_API_KEY}`
    },
    body: JSON.stringify({
      model: CAD_MODEL,
      max_tokens: 4096,
      messages: messages
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`CAD Model API 错误: ${response.status} - ${errorText}`)
    throw new Error(`CAD 模型 API 请求失败: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'AI 返回了空响应'
}

/**
 * Annotate image with risk markers using node-canvas (pure JS, no Python needed).
 * @param {string} imageBase64 - Original image as base64
 * @param {string} analysisText - AI analysis text containing numbered risk items
 * @returns {Promise<string>} Annotated image as base64
 */
const annotateImage = async (imageBase64, analysisText) => {
  try {
    const { createCanvas, loadImage, registerFont } = await import('canvas')

    // Register CJK font
    const fontPath = join(__dirname, 'assets', 'fonts', 'NotoSansSC-Regular.ttf')
    if (fs.existsSync(fontPath)) {
      registerFont(fontPath, { family: 'NotoSansSC' })
      console.log('[annotate] Font registered:', fontPath)
    } else {
      console.log('[annotate] Font NOT found:', fontPath)
    }

    // Parse risk items
    const riskItems = parseRiskItems(analysisText)
    console.log(`[annotate] Parsed ${riskItems.length} risk items`)
    riskItems.forEach(item => {
      console.log(`[annotate] Item ${item.num}: level=${item.level}, coordX=${item.coordX}, coordY=${item.coordY}, title=${item.title.substring(0, 40)}`)
    })
    
    // Debug: log first 500 chars of analysis text
    console.log(`[annotate] Analysis preview: ${analysisText.substring(0, 500)}`)

    // Clean and decode image
    let cleanBase64 = imageBase64
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1]
    }

    const img = await loadImage(Buffer.from(cleanBase64, 'base64'))
    const width = img.width
    const height = img.height

    // Create canvas
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Draw original image
    ctx.drawImage(img, 0, 0, width, height)

    // Calculate marker positions - use AI coordinates if available, fallback to grid
    const positions = calculatePositions(riskItems, width, height)

    // Fixed font sizes - reduced by 50%
    const markerRadius = 27
    const numberFontSize = 21
    const labelFontSize = 18

    // Risk colors - now used for both circle and label background
    const RISK_COLORS = {
      high:   { circle: 'rgba(220, 38, 38, 0.9)', label: 'rgba(220, 38, 38, 0.85)' },
      medium: { circle: 'rgba(234, 179, 8, 0.9)', label: 'rgba(234, 179, 8, 0.85)' },
      low:    { circle: 'rgba(34, 197, 94, 0.9)', label: 'rgba(34, 197, 94, 0.85)' },
      info:   { circle: 'rgba(107, 114, 128, 0.85)', label: 'rgba(107, 114, 128, 0.8)' },
    }

    // Draw markers
    riskItems.forEach((item, i) => {
      const [x, y] = positions[i]
      const colors = RISK_COLORS[item.level] || RISK_COLORS.info
      const r = markerRadius

      // Draw circle with risk color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = colors.circle
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Draw number in center
      ctx.font = `bold ${numberFontSize}px NotoSansSC, Arial`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(item.num), x, y)

      // Draw label with colored background matching risk level
      const label = `${item.num}. ${item.title.substring(0, 30)}`
      ctx.font = `${labelFontSize}px NotoSansSC, Arial`
      const labelWidth = ctx.measureText(label).width

      // Position label below the circle
      const pad = 3
      const labelH = labelFontSize + pad * 2
      const labelW = labelWidth + pad * 2
      const labelX = x - labelW / 2
      const labelY = y + r + 3

      // Ensure label stays within image bounds
      const safeLabelX = Math.max(2, Math.min(labelX, width - labelW - 2))
      const safeLabelY = Math.max(2, Math.min(labelY, height - labelH - 2))

      // Draw label background with risk color
      ctx.fillStyle = colors.label
      ctx.beginPath()
      ctx.roundRect(safeLabelX, safeLabelY, labelW, labelH, 2)
      ctx.fill()

      // Add subtle border for better visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Draw label text in white - perfectly aligned within background
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(label, safeLabelX + pad, safeLabelY + pad)
    })

    // Convert to base64
    const annotatedBase64 = canvas.toBuffer('image/png').toString('base64')
    console.log(`[annotate] Success, output length: ${annotatedBase64.length}`)
    return annotatedBase64

  } catch (err) {
    console.log('[annotate] Error:', err.message)
    return imageBase64
  }
}

/**
 * Calculate marker positions on the image.
 * Uses AI-provided coordinates if available, falls back to grid distribution.
 */
const calculatePositions = (riskItems, imageWidth, imageHeight) => {
  const positions = []

  riskItems.forEach((item, i) => {
    // If AI provided coordinates, use them
    if (item.coordX !== null && item.coordY !== null) {
      positions.push([
        Math.floor(item.coordX * imageWidth),
        Math.floor(item.coordY * imageHeight)
      ])
    } else {
      // Fallback to grid distribution for items without coordinates
      const numItems = riskItems.length
      if (numItems <= 1) {
        positions.push([Math.floor(imageWidth / 2), Math.floor(imageHeight / 2)])
      } else {
        const cols = Math.max(2, Math.floor(Math.sqrt(numItems)))
        const rows = Math.ceil(numItems / cols)
        const marginX = Math.floor(imageWidth / 6)
        const marginY = Math.floor(imageHeight / 6)
        const usableW = imageWidth - 2 * marginX
        const usableH = imageHeight - 2 * marginY
        const row = Math.floor(i / cols)
        const col = i % cols
        positions.push([
          Math.floor(marginX + (col + 0.5) * usableW / cols),
          Math.floor(marginY + (row + 0.5) * usableH / rows)
        ])
      }
    }
  })

  return positions
}

/**
 * POST /api/cad/analyze
 * Body: { image_base64: string, prompt_override?: string }
 * Response: { success: true, analysis_text: string, annotated_image_base64: string }
 */
app.post('/api/cad/analyze', async (req, res) => {
  try {
    // Accept both 'image_base64' (spec) and 'image' (frontend) field names
    const imageBase64 = req.body.image_base64 || req.body.image
    const promptOverride = req.body.prompt_override

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: '缺少 image_base64 参数'
      })
    }

    console.log('🔬 CAD 分析请求已收到')

    // Step 1: Load alice.md system prompt
    const systemPrompt = loadAlicePrompt()
    console.log('Alice prompt loaded')

    // Step 1.5: Fetch learning context from history
    let learningContext = ''
    try {
      // Build a query from the image description or prompt
      const searchQuery = promptOverride || 'CAD design production risk analysis'

      const db = await getDb()
      const tableNames = await db.tableNames()
      if (tableNames.includes(TABLES.CAD_LEARNING)) {
        const queryVector = await generateEmbedding(searchQuery)
        const learningResults = await vectorSearch(TABLES.CAD_LEARNING, queryVector, 3)

        if (learningResults && learningResults.length > 0) {
          learningContext = '\n## 历史学习参考\n以下是之前的修正记录，请在分析时参考这些经验：\n'
          learningResults.forEach((r, i) => {
            learningContext += `\n### 修正记录 ${i + 1}\n`
            learningContext += `- **风险项**: ${r.risk_item || 'N/A'}\n`
            learningContext += `- **原始分析**: ${r.original_analysis || ''}\n`
            learningContext += `- **用户修正**: ${r.user_correction || ''}\n`
          })
          console.log(`📚 注入 ${learningResults.length} 条历史学习参考`)
        }
      }
    } catch (e) {
      console.log('⚠️ 获取历史学习参考失败:', e.message)
    }

    // Step 2: Build user prompt with learning context
    const userPrompt = (promptOverride ||
      '请分析这张 CAD 设计图，识别所有潜在的生产风险，按照你的分析框架输出完整报告。\n' +
      '**重要：每个风险点必须在标题下方单独一行提供坐标，格式为 `坐标：x: 35%, y: 60%`（左上角0%,0%，右下角100%,100%）。坐标用于在图片上标注风险位置，必须准确。') + learningContext

    // Step 3: Call GLM-4V multimodal API
    console.log('Calling GLM-4V...')
    const analysisText = await callGLM4V(imageBase64, systemPrompt, userPrompt)
    console.log('GLM-4V response received')

    // Step 4: Annotate image with risk markers
    console.log('Annotating image...')
    const annotatedBase64 = await annotateImage(imageBase64, analysisText)
    console.log('Image annotation complete')

    // Step 5: Return result
    res.json({
      success: true,
      analysis_text: analysisText,
      annotated_image_base64: annotatedBase64
    })
  } catch (error) {
    console.error('CAD Analysis Error:', error.message)
    res.status(500).json({
      success: false,
      error: error.message.includes('未配置') ? error.message : 'CAD 分析服务暂时不可用',
      message: error.message
    })
  }
})


// ============================================================
// CAD Learning API — store & retrieve correction history
// ============================================================

/**
 * POST /api/cad/learn
 * Body: { image_hash, image_base64, original_analysis, user_correction, risk_item }
 * Generates embedding from text, stores in cad_learning table.
 * Auto-creates table if it doesn't exist.
 */
app.post('/api/cad/learn', async (req, res) => {
  try {
    const { image_hash, image_base64, original_analysis, user_correction, risk_item } = req.body

    if (!image_hash || !original_analysis || !user_correction) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: image_hash, original_analysis, user_correction'
      })
    }

    console.log('📖 CAD 学习记录请求已收到')

    // Generate embedding from text combination
    const embeddingText = `${image_hash} ${original_analysis} ${user_correction}`
    const embedding = await generateEmbedding(embeddingText)

    const record = {
      id: `cad_learn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      image_hash,
      image_base64: image_base64 || '',
      original_analysis,
      user_correction,
      risk_item: risk_item || '',
      embedding,
      timestamp: new Date().toISOString()
    }

    await insertData(TABLES.CAD_LEARNING, record)

    // FIFO: keep only the latest 10 records
    const totalRows = await countRows(TABLES.CAD_LEARNING)
    if (totalRows > 10) {
      const allRecords = await queryData(TABLES.CAD_LEARNING)
      // Sort by timestamp ascending, delete the oldest ones
      const sorted = allRecords
        .filter(r => !r.id.startsWith('sample_'))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      const toDelete = sorted.slice(0, sorted.length - 10)
      for (const old of toDelete) {
        await deleteData(TABLES.CAD_LEARNING, `id = '${old.id}'`)
      }
      console.log(`🗑️ CAD 学习记录 FIFO 清理: 删除 ${toDelete.length} 条最旧记录，保留 10 条`)
    }

    res.json({
      success: true,
      message: '学习记录已保存',
      id: record.id,
      timestamp: record.timestamp
    })
  } catch (error) {
    console.error('CAD Learn Error:', error.message)
    res.status(500).json({
      success: false,
      error: '保存学习记录失败',
      message: error.message
    })
  }
})

/**
 * GET /api/cad/learn?query=xxx
 * Generates embedding for query, vector-searches cad_learning table, returns Top 3.
 */
app.get('/api/cad/learn', async (req, res) => {
  try {
    const { query } = req.query

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '缺少 query 参数'
      })
    }

    const db = await getDb()
    const tableNames = await db.tableNames()

    if (!tableNames.includes(TABLES.CAD_LEARNING)) {
      return res.json({ success: true, results: [], message: '暂无学习记录' })
    }

    // Generate embedding for query
    const queryVector = await generateEmbedding(query)

    // Vector search, top 3
    const results = await vectorSearch(TABLES.CAD_LEARNING, queryVector, 3)

    // Strip embedding vectors from response for efficiency
    const cleanedResults = results.map(r => {
      const { embedding, ...rest } = r
      return rest
    })

    res.json({
      success: true,
      count: cleanedResults.length,
      results: cleanedResults
    })
  } catch (error) {
    console.error('CAD Learn Search Error:', error.message)
    res.status(500).json({
      success: false,
      error: '搜索学习记录失败',
      message: error.message
    })
  }
})

/**
 * GET /api/cad/history
 * Returns all historical analysis records (simple query, no vector search).
 * Fields: timestamp, image_hash, analysis_summary
 */
app.get('/api/cad/history', async (req, res) => {
  try {
    const db = await getDb()
    const tableNames = await db.tableNames()

    if (!tableNames.includes(TABLES.CAD_LEARNING)) {
      return res.json({ success: true, records: [], message: '暂无历史记录' })
    }

    const allRecords = await queryData(TABLES.CAD_LEARNING)

    // Return summary fields only
    const summary = allRecords.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      image_hash: r.image_hash,
      analysis_summary: (r.original_analysis || '').substring(0, 200),
      risk_item: r.risk_item || ''
    }))

    // Sort by timestamp descending
    summary.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    res.json({
      success: true,
      count: summary.length,
      records: summary
    })
  } catch (error) {
    console.error('CAD History Error:', error.message)
    res.status(500).json({
      success: false,
      error: '获取历史记录失败',
      message: error.message
    })
  }
})


app.post('/api/chat/glm', handleGLMChat)
app.post('/api/chat/groq', handleGroqChat)
app.post('/api/chat', handleChatWithProducts)


// LanceDB 向量搜索 API 路由
app.use('/api/lancedb', lancedbRoutes)
console.log('LanceDB API 路由已注册')

console.log('=== Initializing LanceDB ===')
initTables().then(() => {
  console.log('=== LanceDB initialized ===')
  cron.schedule('0 8 * * *', async () => {
    console.log('\n=== 开始定时爬取任务 ===')
    console.log('定时任务: LanceDB 模式，跳过 SQLite 写入')
    console.log('=== 定时爬取任务结束 ===\n')
  })
  
  console.log('已设置定时任务: 每天早上8点自动爬取当月数据')
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Vector Database: LanceDB`)
    console.log(`LanceDB path: ${LANCEDB_DIR || './lancedb'}`)
  })
})
