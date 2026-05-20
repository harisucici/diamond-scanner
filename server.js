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
import { initTables, getStats as getLanceDbStats, LANCEDB_DIR, queryData, insertData, deleteData, vectorSearch, getTable, TABLES } from './db/lancedb.js'
import { generateEmbedding, cosineSimilarity } from './services/embeddingService.js'
import lancedbRoutes from './routes/lancedbRoutes.js'
// 加载统一配置
import * as config from './config/index.js'

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

app.use(cors())
app.use(express.json())

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
      items: result.items.slice(0, 5)
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
      items: result.items.slice(0, 5)
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
  
  const prompt = `你是一个珠宝品类识别助手。根据用户的问题，从以下可选品类中选择最匹配的一个品类。

【可选品类列表】
${availableCategories.join('\n')}

【用户问题】
${query}

【回答要求】
1. 只返回一个品类名称，必须从可选品类列表中选择
2. 如果用户问题中没有明确指向某个品类，或无法确定，返回 "null"
3. 不要返回任何解释，只返回品类名称或 null

示例：
用户问"有什么戒指推荐" → 返回: 指輪・リング
用户问"推荐一些珠宝" → 返回: null
用户问"项链多少钱" → 返回: ネックレス・チョーカー`

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
    
    // 使用语义搜索替代关键词搜索
    if (lastUserMessage) {
      // 直接使用用户的问题进行语义搜索
      products = await semanticSearchAllProfiles(lastUserMessage.content, 5)
      console.log(`🔍 语义搜索找到 ${products.length} 个相关产品`)
    }
    
    let productContext = ''
    if (products.length > 0) {
      productContext = '\n\n【重要：当前库存中的相关产品】\n以下是系统通过语义搜索从所有品类中为您匹配的产品，你必须在回答中只从这些产品中选择推荐，不可编造其他产品：\n\n' + products.map((p, i) => 
        `${i + 1}. 【${p.brand}】${p.productName}\n   价格: ${p.price}\n   来源: ${p.source}\n   相似度: ${(p.similarity * 100).toFixed(1)}%\n   ${p.url ? `链接: ${p.url}` : '(暂无链接)'}`
      ).join('\n\n')
    } else {
      productContext = '\n\n【注意】当前库存中没有找到完全匹配的产品，请根据用户需求提供一般性建议，并告知可以记录需求或推荐相似品类。'
    }
    
    // 使用配置替代硬编码
    const provider = config.chat.defaultProvider
    const apiMessages = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT + productContext + '\n\n【回答要求】\n1. 根据用户需求，从上述产品列表中选择最合适的进行推荐\n2. 必须说明产品的品牌、名称、价格和来源\n3. 如果有购买链接，提醒用户点击产品卡片查看详情\n4. 如果没有合适产品，诚实告知并提供替代建议'
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
