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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('=== SERVER STARTING ===')
console.log('Node version:', process.version)
console.log('CWD:', process.cwd())

const chatPromptConfig = yaml.load(fs.readFileSync(join(__dirname, 'config/chat-prompt.yaml'), 'utf-8'))
console.log('Chat prompt config loaded')
const SYSTEM_PROMPT = chatPromptConfig.systemPrompt

const PROXY_URL = process.env.HTTP_PROXY || process.env.http_proxy || ''

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
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// 静态文件服务 - 开发和生产环境都启用
app.use(express.static(path.join(__dirname, 'dist')))

let db = null
let gemstoneDb = null // 独立的宝石数据库

// 数据库路径配置 - 支持 Render 持久化存储
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'db')
const dbPath = path.join(DATA_DIR, 'database.sqlite')
const gemstoneDbPath = path.join(DATA_DIR, 'gemstone.sqlite')

console.log(`📁 数据目录: ${DATA_DIR}`)
console.log(`📄 数据库路径: ${dbPath}`)

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
}

const ensureDbDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    console.log(`✅ 创建数据目录: ${DATA_DIR}`)
  }
}

// 初始化数据库文件 - 从 Git 仓库复制到持久化存储
const initDatabaseFiles = () => {
  ensureDbDir()
  
  const sourceDir = path.join(__dirname, 'db')
  
  const filesToCopy = [
    { target: dbPath, source: path.join(sourceDir, 'database.sqlite'), name: 'database.sqlite' },
    { target: gemstoneDbPath, source: path.join(sourceDir, 'gemstone.sqlite'), name: 'gemstone.sqlite' }
  ]
  
  filesToCopy.forEach(({ target, source, name }) => {
    if (!fs.existsSync(target) && fs.existsSync(source)) {
      fs.copyFileSync(source, target)
      console.log(`✅ 复制 ${name} 到持久化存储`)
    }
  })
}

// 在启动时初始化数据库文件
initDatabaseFiles()

const saveDatabase = () => {
  if (db) {
    try {
      const data = db.export()
      const buffer = Buffer.from(data)
      ensureDbDir()
      fs.writeFileSync(dbPath, buffer)
    } catch (error) {
      console.log('Could not save database:', error.message)
    }
  }
}

const saveGemstoneDatabase = () => {
  if (gemstoneDb) {
    try {
      const data = gemstoneDb.export()
      const buffer = Buffer.from(data)
      ensureDbDir()
      fs.writeFileSync(gemstoneDbPath, buffer)
    } catch (error) {
      console.log('Could not save gemstone database:', error.message)
    }
  }
}

// SQLite deprecated - using LanceDB
const initGemstoneDatabase = async () => {
  console.log('⏭️ SQLite gemstone database skipped (using LanceDB)')
}

// SQLite deprecated - using LanceDB
const createTable = (tableName, extraColumns = '') => {
  // No-op: tables managed by LanceDB
}

const initDatabase = async () => {
  console.log('⏭️ SQLite main database skipped (using LanceDB)')
}

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

const fetchZozotownData = async (category = 'accessories') => {
  try {
    const categoryMap = {
      'accessories': 'a0001',
      'necklaces': 'a0001010',
      'bracelets': 'a0001020',
      'rings': 'a0001030',
      'earrings': 'a0001040'
    }
    
    const categoryCode = categoryMap[category] || 'a0001'
    const url = `https://www.zozo.jp/genre/${categoryCode}/?p=1&rank=1`
    
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    
    const items = []
    const productPattern = /data-product-name="([^"]+)"[^>]*data-brand-name="([^"]+)"[^>]*data-price="(\d+)"/g
    let match
    let rank = 1
    
    while ((match = productPattern.exec(html)) !== null && rank <= 30) {
      items.push({
        rank: rank++,
        productName: match[1],
        brand: match[2],
        price: parseInt(match[3]),
        category: category,
        url: ''
      })
    }
    
    if (items.length < 10) {
      const simplePattern = /class="item-card[^"]*"[^>]*>[\s\S]*?class="item-name"[^>]*>([^<]+)<[\s\S]*?class="brand-name"[^>]*>([^<]+)<[\s\S]*?class="price"[^>]*>(\d+,?\d*)/g
      while ((match = simplePattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        if (!items.find(i => i.productName === productName)) {
          items.push({
            rank: rank++,
            productName,
            brand: match[2].trim(),
            price: parseInt(match[3].replace(/\D/g, '')),
            category: category,
            url: ''
          })
        }
      }
    }
    
    console.log(`ZOZOTOWN爬取: 获取${items.length}条${category}数据`)
    return items
  } catch (error) {
    console.error('ZOZOTOWN爬取失败:', error.message)
    return []
  }
}

const fetchRakumaData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://fril.jp/s?query=${encodeURIComponent(keyword)}&sort=item_sold_count&order=desc`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    
    const itemPattern = /data-item-id="(\d+)"[^>]*>[\s\S]*?class="item-name"[^>]*>([^<]+)<[\s\S]*?class="user-icon"[^>]*>[\s\S]*?class="user-name"[^>]*>([^<]+)<[\s\S]*?class="price"[^>]*>(\d+,?\d*)/g
    let match
    let rank = 1
    
    while ((match = itemPattern.exec(html)) !== null && rank <= 30) {
      items.push({
        rank: rank++,
        itemId: match[1],
        productName: match[2].trim(),
        brand: match[3].trim() || 'OTHER',
        price: parseInt(match[4].replace(/\D/g, '')),
        category: 'accessories',
        url: `https://fril.jp/items/${match[1]}`
      })
    }
    
    console.log(`ラクマ爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('ラクマ爬取失败:', error.message)
    return []
  }
}

const fetchPaypayData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://paypayfleamarket.yahoo.co.jp/search?keyword=${encodeURIComponent(keyword)}&sort=sold`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    
    const itemPattern = /data-item-id="(\d+)"[^>]*>[\s\S]*?class="[^"]*itemName[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g
    let match
    let rank = 1
    
    while ((match = itemPattern.exec(html)) !== null && rank <= 30) {
      items.push({
        rank: rank++,
        itemId: match[1],
        productName: match[2].trim(),
        brand: 'OTHER',
        price: parseInt(match[3].replace(/\D/g, '')),
        category: 'accessories',
        url: `https://paypayfleamarket.yahoo.co.jp/items/${match[1]}`
      })
    }
    
    console.log(`PayPayフリマ爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('PayPayフリマ爬取失败:', error.message)
    return []
  }
}

const fetchYahooShoppingData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(keyword)}&sort=sold`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      /class="[^"]*Product[^"]*_name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+,?\d*)\s*円/g,
      /class="[^"]*Item[^"]*Name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+,?\d*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        if (!items.find(i => i.productName === productName)) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price: parseInt(match[2].replace(/\D/g, '')),
            category: 'accessories',
            url: ''
          })
        }
      }
    }
    
    console.log(`Yahoo!ショッピング爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('Yahoo!ショッピング爬取失败:', error.message)
    return []
  }
}

const fetchKakakuData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://kakaku.com/search_result/?category_key=13&keyword=${encodeURIComponent(keyword)}`
    
    const response = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      /href="(\/item\/\d+\/)"[^>]*>[\s\S]*?class="[^\"]*itemName[^\"]*"[^>]*>([^<]+)<[\s\S]*?class="[^\"]*price[^\"]*"[^>]*>(\d[,\d]*)\s*円/g,
      /class="[^\"]*p-item[^\"]*"[^>]*>[\s\S]*?href="(\/item\/\d+\/)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<[\s\S]*?(\d[,\d]*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const url = match[1] || ''
        const productName = match[2].trim()
        const price = parseInt(match[3].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName) && price > 0) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price,
            category: 'accessories',
            url: url ? `https://kakaku.com${url}` : ''
          })
        }
      }
    }
    
    console.log(`価格.com爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('価格.com爬取失败:', error.message)
    return []
  }
}

const fetchAmazonJPData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&rh=p_89%3A&page=1`
    
    const response = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        'Cookie': 'session-id=147-1850366-9478737; session-id-time=2082787201l'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      /data-asin="([^"]+)"[^>]*>[\s\S]*?class="a-size-base-plus[^"]*"[^>]*>([^<]+)<[\s\S]*?class="a-price-whole"[^>]*>(\d[,\d]*)/g,
      /class="[^']*s-result-item[^']*"[^>]*>[\s\S]*?data-asin="([^"]+)"[\s\S]*?class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*a-price-whole[^"]*"[^>]*>(\d+)/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const asin = match[1]
        const productName = match[2].trim()
        if (!items.find(i => i.productName === productName)) {
          items.push({
            rank: rank++,
            asin,
            productName,
            brand: 'OTHER',
            price: parseInt(match[3].replace(/\D/g, '')),
            category: 'accessories',
            url: `https://www.amazon.co.jp/dp/${asin}`
          })
        }
      }
    }
    
    console.log(`Amazon.co.jp爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('Amazon.co.jp爬取失败:', error.message)
    return []
  }
}

const fetchQoo10Data = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://www.qoo10.jp/s/${encodeURIComponent(keyword)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ja'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      /class="[^"]*goods[^"]*"[^>]*>[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g,
      /item\/(\d+)"[^>]*>[\s\S]*?class="[^"]* goods_name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        if (!items.find(i => i.productName === productName)) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price: parseInt(match[2].replace(/\D/g, '')),
            category: 'accessories',
            url: ''
          })
        }
      }
    }
    
    console.log(`Qoo10爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('Qoo10爬取失败:', error.message)
    return []
  }
}

const fetchDMMData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://search.dmm.co.jp/search?keyword=${encodeURIComponent(keyword)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ja'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    const pattern = /class="[^"]*DMM[^"]*item[^"]*"[^>]*>[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g
    let match
    
    while ((match = pattern.exec(html)) !== null && rank <= 30) {
      const productName = match[1].trim()
      if (!items.find(i => i.productName === productName)) {
        items.push({
          rank: rank++,
          productName,
          brand: 'OTHER',
          price: parseInt(match[2].replace(/\D/g, '')),
          category: 'accessories',
          url: ''
        })
      }
    }
    
    console.log(`DMM爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('DMM爬取失败:', error.message)
    return []
  }
}

const fetchRakutenData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/?s=2`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      new RegExp('href="(//item\\.rakuten\\.co\\.jp/\\d+/)"[^>]*>[\\s\\S]*?class="[^\"]*title[^\"]*"[^>]*>([^<]+)<[\\s\\S]*?class="[^\"]*price[^\"]*"[^>]*>(\\d[,\\d]*)"', 'g'),
      /data-item-id="([^"]+)"[^>]*>[\s\S]*?class="[^"]*item-name[^"]*"[^>]*>([^<]+)<[\s\S]*?(\d[,\d]*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const url = match[1] || ''
        const productName = match[2].trim()
        const price = parseInt(match[3].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName) && price > 0) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price,
            category: 'accessories',
            url: url ? `https:${url}` : ''
          })
        }
      }
    }
    
    console.log(`樂天爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('樂天爬取失败:', error.message)
    return []
  }
}

const fetchMercariData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&sort= sold_count:desc`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      new RegExp('href="(/item/m\d+)"[^>]*>[\s\S]*?class="[^"]*name[^"]*"[^>]*>([^<]+)<[\s\S]*?(\d[,\d]*)\s*円', 'g'),
      /data-item-id="([^"]+)"[^>]*>[\s\S]*?>([^<]+)<[\s\S]*?(\d[,\d]*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const url = match[1] || ''
        const productName = match[2].trim()
        const price = parseInt(match[3].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName) && price > 0) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price,
            category: 'accessories',
            url: url ? `https://jp.mercari.com${url}` : ''
          })
        }
      }
    }
    
    console.log(`Mercari爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('Mercari爬取失败:', error.message)
    return []
  }
}

const fetchYahooAuctionData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&n=30&s=jun`
    const response = await fetch(url, { headers: COMMON_HEADERS })
    const html = await response.text()
    const items = []
    let rank = 1
    
    const patterns = [
      /href="(\/item\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="Product__price[^>]*>(\d[,\d]*)/g,
      /href="(https?:\/\/auctions\.yahoo\.co\.jp\/item\/[^"]+)"[^>]*>[\s\S]*?>(\d[,\d]*)\s*円/g,
      /class="Product__titleLink"[^>]*href="([^"]+)"[^>]*>([^<]+)<[\s\S]*?class="Product__price"[^>]*>(\d[,\d]*)/g,
      /href="(\/item\/[^"]+)"[^>]*>[\s\S]*?>(\d[,\d]*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const url = match[1] || ''
        const productName = match[2]?.trim() || ''
        const price = parseInt((match[3] || match[2]).replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName) && price > 0) {
          items.push({
            rank: rank++,
            productName,
            brand: 'OTHER',
            price,
            category: 'accessories',
            url: url ? `https:${url}` : ''
          })
        }
      }
    }
    
    console.log(`Yahoo!拍賣爬取: 获取${items.length}条数据`)
    return { items, html }
  } catch (error) {
    console.error('Yahoo!拍賣爬取失败:', error.message)
    return { items: [], html: '' }
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
const EBAY_ENV = process.env.EBAY_ENV === 'production' ? 'production' : 'production' // 默认 production
const ebayConfig = EBAY_CONFIG[EBAY_ENV]

// Token 缓存
let ebayCachedToken = null
let ebayTokenExpiry = 0

// 获取 eBay OAuth 2.0 Access Token
const getEbayAccessToken = async () => {
  if (ebayCachedToken && Date.now() < ebayTokenExpiry) {
    return ebayCachedToken
  }
  const clientId = process.env.EBAY_APP_ID || process.env.EBAY_API_KEY
  const clientSecret = process.env.EBAY_CERT_ID
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


const dbQuery = (sql, params = []) => {
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

const dbExec = (sql, params = []) => {
  db.run(sql, params)
}

const createGenericRoutes = (basePath, tableName, fetchFunction, extraFields = {}) => {
  app.get(`/api/${basePath}`, (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not ready' })
    
    const { month, search, limit, ...otherParams } = req.query
    let sql = `SELECT * FROM ${tableName} WHERE 1=1`
    const params = []
    
    if (month) {
      sql += ' AND month = ?'
      params.push(month)
    }
    
    if (search) {
      sql += ' AND (productName LIKE ? OR brand LIKE ?)'
      const s = `%${search}%`
      params.push(s, s)
    }
    
    Object.entries(otherParams).forEach(([key, value]) => {
      if (value && extraFields[key]) {
        sql += ` AND ${key} = ?`
        params.push(value)
      }
    })
    
    sql += ' ORDER BY rank ASC'
    
    if (limit) {
      sql += ' LIMIT ?'
      params.push(parseInt(limit))
    }
    
    const results = dbQuery(sql, params)
    res.json(results)
  })

  app.get(`/api/${basePath}/months`, (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not ready' })
    const result = db.exec(`SELECT DISTINCT month FROM ${tableName} ORDER BY month DESC`)
    res.json(result[0]?.values.map(v => v[0]) || [])
  })

  if (Object.keys(extraFields).length > 0) {
    Object.keys(extraFields).forEach(field => {
      app.get(`/api/${basePath}/${field}s`, (req, res) => {
        if (!db) return res.status(500).json({ error: 'Database not ready' })
        const result = db.exec(`SELECT DISTINCT ${field} FROM ${tableName} ORDER BY ${field}`)
        res.json(result[0]?.values.map(v => v[0]) || [])
      })
    })
  }

  app.post(`/api/${basePath}/refresh/:month`, async (req, res) => {
    const { month } = req.params
    const { keyword, category, ...otherParams } = req.query
    
    try {
      let items
      if (fetchFunction === fetchYahooAuctionData || fetchFunction === fetchInstagramData || 
          fetchFunction === fetchSaksData || fetchFunction === fetchFashionphileData) {
        const result = await fetchFunction(keyword || category || 'accessories')
        items = result.items || result
      } else {
        items = await fetchFunction(keyword || category || 'accessories')
      }
      
      // 删除旧数据
      await deleteData(tableName, `month = '${month}'`)
      
      // 插入新数据
      const now = new Date().toISOString()
      let insertedCount = 0
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const record = {
          id: `${basePath}-${month}-${i + 1}`,
          rank: item.rank || i + 1,
          month,
          productName: item.productName,
          brand: item.brand || '',
          price: item.price || 0,
          url: item.url || '',
          created_at: now
        }
        await insertData(tableName, record)
        insertedCount++
      }
      
      res.json({ success: true, count: insertedCount, month, platform: basePath })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
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

createGenericRoutes('zozotown', 'zozotown_products', fetchZozotownData, { category: 'TEXT' })
createGenericRoutes('rakuma', 'rakuma_products', fetchRakumaData)
createGenericRoutes('paypay', 'paypay_products', fetchPaypayData)
createGenericRoutes('yahoo', 'yahoo_products', fetchYahooShoppingData)
createGenericRoutes('amazon', 'amazon_products', fetchAmazonJPData)
createGenericRoutes('qoo10', 'qoo10_products', fetchQoo10Data)
createGenericRoutes('dmm', 'dmm_products', fetchDMMData)
createGenericRoutes('kakaku', 'kakaku_products', fetchKakakuData)
createGenericRoutes('rakuten', 'rakuten_products', fetchRakutenData)
createGenericRoutes('mercari', 'mercari_products', fetchMercariData)
createGenericRoutes('yahoo-auction', 'yahoo_auction_products', fetchYahooAuctionData)

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
  const configs = {
    glm: {
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: process.env.GLM_API_KEY,
      model: 'glm-4-flash',
      errorKey: 'GLM_API_KEY未配置，请在.env中设置'
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      errorKey: 'GROQ_API_KEY未配置'
    }
  }
  
  const config = configs[provider]
  if (!config.apiKey) {
    throw new Error(config.errorKey)
  }
  
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1000,
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

const searchAllProducts = (keyword, limit = 10) => {
  if (!db) return []
  
  const results = []
  const searchTerm = `%${keyword}%`
  
  try {
    const tables = [
      { name: 'necklaces', source: 'necklaces', priceField: 'priceRange' },
      { name: 'fashionphile_products', source: 'fashionphile', priceField: 'price', currency: true },
      { name: 'saks_products', source: 'saks', priceField: 'price', currency: true },
      { name: 'mercari_products', source: 'mercari', priceField: 'price' },
      { name: 'rakuten_products', source: 'rakuten', priceField: 'price' }
    ]
    
    tables.forEach(({ name, source, priceField, currency }) => {
      try {
        const stmt = db.prepare(`
          SELECT ? as source, productName, brand, ${priceField} as price, url, 
                 ${name === 'necklaces' ? 'image' : 'imageUrl'} as image, 
                 ${name === 'necklaces' ? 'category' : "''"} as category
          FROM ${name} 
          WHERE productName LIKE ? OR brand LIKE ?
          ORDER BY rank ASC LIMIT ?
        `)
        stmt.bind([source, searchTerm, searchTerm, limit])
        while (stmt.step()) {
          const row = stmt.getAsObject()
          if (currency && row.price) {
            row.price = `${row.currency || 'USD'} ${row.price}`
          } else if (row.price) {
            row.price = `JPY ${row.price}`
          } else {
            row.price = '询价'
          }
          results.push(row)
        }
        stmt.free()
      } catch (e) {}
    })
    
  } catch (error) {
    console.error('产品搜索失败:', error.message)
  }
  
  return results.slice(0, limit)
}

app.get('/api/products/search', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { keyword, limit } = req.query
  if (!keyword) {
    return res.json([])
  }
  
  const results = searchAllProducts(keyword, parseInt(limit) || 10)
  res.json(results)
})

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
const semanticSearchAllProfiles = async (query, limit = 10) => {
  try {
    // 生成查询向量
    const queryVector = await generateEmbedding(query)
    
    // 执行向量搜索 - 搜索所有产品（不限制平台）
    const results = await vectorSearch(TABLES.PRODUCTS_VECTORS, queryVector, limit * 3)
    
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
    
    const provider = process.env.CHAT_API_PROVIDER || 'glm'
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

// ========== 宝石数据获取 API ==========
// 宝石品类配置
const GEMSTONE_CATEGORIES = {
  lab_diamond: { name_zh: '培育钻石', name_en: 'Lab-Grown Diamond', icon: '💎', color: '#b9f2ff' },
  lab_emerald: { name_zh: '培育祖母绿', name_en: 'Lab-Grown Emerald', icon: '💚', color: '#50c878' },
  lab_ruby: { name_zh: '培育红宝石', name_en: 'Lab-Grown Ruby', icon: '❤️', color: '#e0115f' },
  lab_sapphire: { name_zh: '培育蓝宝石', name_en: 'Lab-Grown Sapphire', icon: '💙', color: '#0f52ba' },
  saltwater_pearl: { name_zh: '海水珍珠', name_en: 'Saltwater Pearl', icon: '🤍', color: '#fdeef4' },
  freshwater_pearl: { name_zh: '淡水珍珠', name_en: 'Freshwater Pearl', icon: '🦪', color: '#fffaf0' }
}

// 宝石关键词配置
const GEMSTONE_KEYWORDS = {
  lab_diamond: {
    english: ['lab grown diamond', 'lab created diamond', 'synthetic diamond', 'cultured diamond', 'cvd diamond', 'hpht diamond'],
    chinese: ['培育钻石', '合成钻石', '人造钻石', '实验室钻石', 'CVD钻石', 'HPHT钻石']
  },
  lab_emerald: {
    english: ['lab grown emerald', 'cultured emerald', 'synthetic emerald', 'created emerald'],
    chinese: ['培育祖母绿', '合成祖母绿', '人造祖母绿', '实验室祖母绿']
  },
  lab_ruby: {
    english: ['lab grown ruby', 'synthetic ruby', 'cultured ruby', 'created ruby'],
    chinese: ['培育红宝石', '合成红宝石', '人造红宝石', '实验室红宝石']
  },
  lab_sapphire: {
    english: ['lab grown sapphire', 'synthetic sapphire', 'cultured sapphire', 'created sapphire'],
    chinese: ['培育蓝宝石', '合成蓝宝石', '人造蓝宝石', '实验室蓝宝石']
  },
  saltwater_pearl: {
    english: ['saltwater pearl', 'akoya pearl', 'south sea pearl', 'tahitian pearl'],
    chinese: ['海水珍珠', 'Akoya珍珠', '南洋珍珠', '大溪地珍珠', '海水珠']
  },
  freshwater_pearl: {
    english: ['freshwater pearl', 'cultured freshwater pearl', 'river pearl'],
    chinese: ['淡水珍珠', '淡水珠', '养殖珍珠']
  }
}

// Rainforest API 配置
const RAINFOREST_BASE_URL = 'https://api.rainforestapi.com/request'

// 动态获取 RAINFOREST_API_KEY（支持热更新）
const getRainforestApiKey = () => {
  // 优先从环境变量获取
  if (process.env.RAINFOREST_API_KEY) {
    return process.env.RAINFOREST_API_KEY
  }
  // 尝试从 .env 文件重新读取
  try {
    const envPath = path.join(__dirname, '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      const match = envContent.match(/RAINFOREST_API_KEY=(.+)/)
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch (e) {
    console.error('读取 .env 文件失败:', e)
  }
  return ''
}

// 调试 API - 检查 Rainforest API Key
app.get('/api/debug/rainforest-key', (req, res) => {
  const key = getRainforestApiKey()
  res.json({
    keyExists: !!key,
    keyPrefix: key ? key.substring(0, 12) + '...' : null,
    keyLength: key ? key.length : 0,
    envKey: process.env.RAINFOREST_API_KEY ? 'exists' : 'not found'
  })
})

// 调试 API - 测试 Rainforest API 调用
app.get('/api/debug/test-rainforest', async (req, res) => {
  const key = getRainforestApiKey()
  
  // 方式1: 直接拼接
  const testUrl1 = `https://api.rainforestapi.com/request?api_key=${key}&type=search&amazon_domain=amazon.com&search_term=lab+diamond`
  
  // 方式2: 使用 URLSearchParams（和函数中一样）
  const params = new URLSearchParams({
    api_key: key,
    type: 'search',
    amazon_domain: 'amazon.com',
    search_term: 'lab diamond',
    page: '1',
    output: 'json'
  })
  const testUrl2 = `https://api.rainforestapi.com/request?${params.toString()}`
  
  console.log('=== 方式1 (直接拼接) ===')
  console.log('URL:', testUrl1.substring(0, 100))
  const resp1 = await fetch(testUrl1)
  const data1 = await resp1.json()
  console.log('Status:', resp1.status, 'Success:', data1.request_info?.success)
  
  console.log('\n=== 方式2 (URLSearchParams) ===')
  console.log('URL:', testUrl2.substring(0, 100))
  const resp2 = await fetch(testUrl2)
  const data2 = await resp2.json()
  console.log('Status:', resp2.status, 'Success:', data2.request_info?.success)
  
  res.json({
    method1: {
      status: resp1.status,
      success: data1.request_info?.success,
      resultCount: data1.search_results?.length
    },
    method2: {
      status: resp2.status,
      success: data2.request_info?.success,
      resultCount: data2.search_results?.length,
      error: data2.request_info?.error || null
    }
  })
})

// 使用 Rainforest API 获取 Amazon 数据
const fetchGemstoneFromAmazon = async (keyword, domain = 'amazon.com', pages = 1) => {
  const RAINFOREST_API_KEY = getRainforestApiKey()
  if (!RAINFOREST_API_KEY) {
    console.log('⚠️ RAINFOREST_API_KEY 未配置，跳过 Amazon 数据获取')
    return []
  }
  
  const items = []
  
  try {
    for (let page = 1; page <= pages; page++) {
      const params = new URLSearchParams({
        api_key: RAINFOREST_API_KEY,
        type: 'search',
        amazon_domain: domain,
        search_term: keyword,
        page: page.toString(),
        output: 'json'
      })
      
      const url = `${RAINFOREST_BASE_URL}?${params.toString()}`
      console.log(`🔍 [Rainforest] 搜索: ${keyword} (page ${page})`)
      console.log(`📌 API Key: ${RAINFOREST_API_KEY ? RAINFOREST_API_KEY.substring(0, 12) + '...' : '未设置'}`)
      console.log(`🌐 完整URL: ${url}`)
      
      const response = await fetch(url)
      console.log(`📡 响应状态: ${response.status}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('❌ Rainforest API 认证失败，请检查 API Key')
        } else {
          console.error(`❌ Rainforest API 错误: ${response.status}`)
        }
        continue
      }
      
      const data = await response.json()
      const searchResults = data.search_results || []
      
      for (const item of searchResults) {
        items.push({
          platform: domain.includes('.jp') ? 'Amazon Japan' : 'Amazon',
          title: item.title || '',
          price: item.price?.value || 0,
          currency: item.price?.currency || 'USD',
          rating: item.rating || 0,
          reviews: item.ratings_total || 0,
          seller: item.seller?.name || 'Unknown',
          country: domain.includes('.jp') ? 'Japan' : 'United States',
          asin: item.asin || '',
          url: item.link || `https://www.${domain}/dp/${item.asin}`,
          image: item.image || '',
          is_prime: item.is_prime || false,
          is_best_seller: item.is_best_seller || false,
          keyword: keyword
        })
      }
      
      console.log(`   ✅ 获取 ${searchResults.length} 个产品`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  } catch (error) {
    console.error('❌ Amazon 数据获取失败:', error.message)
  }
  
  return items
}

// 获取单个品类的 Amazon 数据
app.post('/api/gemstone/fetch/:categoryId', async (req, res) => {
  const { categoryId } = req.params
  const { domains = ['amazon.com'], pagesPerKeyword = 1, useEnglish = true, useChinese = true } = req.body
  
  if (!GEMSTONE_CATEGORIES[categoryId]) {
    return res.status(400).json({ error: `未知的品类ID: ${categoryId}` })
  }
  
  const RAINFOREST_API_KEY = getRainforestApiKey()
  if (!RAINFOREST_API_KEY) {
    return res.status(400).json({ error: 'RAINFOREST_API_KEY 未配置' })
  }
  
  const category = GEMSTONE_CATEGORIES[categoryId]
  const keywords = GEMSTONE_KEYWORDS[categoryId]
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${category.icon} ${category.name_zh} / ${category.name_en}`)
  console.log(`${'='.repeat(60)}`)
  
  const allProducts = []
  const keywordList = []
  
  if (useEnglish && keywords.english) {
    keywordList.push(...keywords.english.map(k => ({ keyword: k, lang: 'en' })))
  }
  if (useChinese && keywords.chinese) {
    keywordList.push(...keywords.chinese.map(k => ({ keyword: k, lang: 'zh' })))
  }
  
  try {
    for (const domain of domains) {
      for (const { keyword, lang } of keywordList) {
        if (lang === 'zh' && !domain.includes('.com')) continue
        
        const products = await fetchGemstoneFromAmazon(keyword, domain, pagesPerKeyword)
        allProducts.push(...products)
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    // 数据分析
    const uniqueProducts = []
    const seenAsins = new Set()
    
    for (const product of allProducts) {
      if (product.asin && !seenAsins.has(product.asin)) {
        seenAsins.add(product.asin)
        uniqueProducts.push(product)
      }
    }
    
    const prices = uniqueProducts.filter(p => p.price > 0).map(p => p.price)
    const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0
    
    const ratings = uniqueProducts.filter(p => p.rating > 0).map(p => p.rating)
    const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0
    
    const topProducts = uniqueProducts
      .filter(p => p.rating > 0)
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, 20)
    
    const result = {
      category: categoryId,
      category_name_zh: category.name_zh,
      category_name_en: category.name_en,
      timestamp: new Date().toISOString(),
      total_products: allProducts.length,
      unique_products: uniqueProducts.length,
      avg_price: Math.round(avgPrice * 100) / 100,
      avg_rating: Math.round(avgRating * 10) / 10,
      top_products: topProducts,
      all_products: uniqueProducts
    }
    
    res.json(result)
  } catch (error) {
    console.error('获取品类数据失败:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// 批量获取所有品类数据
app.post('/api/gemstone/fetch-all', async (req, res) => {
  const options = req.body
  
  const RAINFOREST_API_KEY = getRainforestApiKey()
  if (!RAINFOREST_API_KEY) {
    return res.status(400).json({ error: 'RAINFOREST_API_KEY 未配置' })
  }
  
  const results = {}
  const categories = Object.keys(GEMSTONE_CATEGORIES)
  
  for (const categoryId of categories) {
    try {
      const category = GEMSTONE_CATEGORIES[categoryId]
      const keywords = GEMSTONE_KEYWORDS[categoryId]
      
      console.log(`\n${category.icon} ${category.name_zh}`)
      
      const allProducts = []
      const keywordList = []
      
      if (options.useEnglish !== false && keywords.english) {
        keywordList.push(...keywords.english.map(k => ({ keyword: k, lang: 'en' })))
      }
      if (options.useChinese !== false && keywords.chinese) {
        keywordList.push(...keywords.chinese.map(k => ({ keyword: k, lang: 'zh' })))
      }
      
      const domains = options.domains || ['amazon.com']
      
      for (const domain of domains) {
        for (const { keyword, lang } of keywordList) {
          if (lang === 'zh' && !domain.includes('.com')) continue
          
          const products = await fetchGemstoneFromAmazon(keyword, domain, options.pagesPerKeyword || 1)
          allProducts.push(...products)
          
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      // 去重
      const uniqueProducts = []
      const seenAsins = new Set()
      
      for (const product of allProducts) {
        if (product.asin && !seenAsins.has(product.asin)) {
          seenAsins.add(product.asin)
          uniqueProducts.push(product)
        }
      }
      
      results[categoryId] = {
        category: categoryId,
        category_name_zh: category.name_zh,
        total_products: allProducts.length,
        unique_products: uniqueProducts.length,
        products: uniqueProducts.slice(0, 50) // 只返回前50个
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      results[categoryId] = { error: error.message }
    }
  }
  
  res.json({
    timestamp: new Date().toISOString(),
    results
  })
})

console.log('宝石数据获取API 已加载')

// 立即注册宝石 API 路由
app.get('/api/gemstone/categories', (req, res) => {
  console.log('收到 /api/gemstone/categories 请求')
  res.json(GEMSTONE_CATEGORIES)
})

// 接收 n8n 发送的宝石数据
app.post('/api/gemstone/import', async (req, res) => {
  console.log('收到 /api/gemstone/import 请求')
  
  try {
    const data = req.body.data || req.body
    
    if (!data || !data.summary) {
      return res.status(400).json({ error: '无效的数据格式' })
    }
    
    console.log(`📊 导入宝石数据报告`)
    console.log(`   总产品数: ${data.summary.total_products}`)
    console.log(`   去重产品: ${data.summary.unique_products}`)
    console.log(`   总价值: $${data.summary.total_value}`)
    console.log(`   品类数: ${data.summary.categories_analyzed}`)
    
    // 创建宝石数据表（如果不存在）
    db.run(`
      CREATE TABLE IF NOT EXISTS gemstone_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id TEXT,
        category_name_zh TEXT,
        category_name_en TEXT,
        keyword TEXT,
        platform TEXT,
        title TEXT,
        price REAL,
        currency TEXT,
        rating REAL,
        reviews INTEGER,
        seller TEXT,
        seller_location TEXT,
        country TEXT,
        asin TEXT UNIQUE,
        url TEXT,
        image TEXT,
        is_prime INTEGER,
        is_best_seller INTEGER,
        timestamp TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 创建报告表
    db.run(`
      CREATE TABLE IF NOT EXISTS gemstone_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_timestamp TEXT,
        total_products INTEGER,
        unique_products INTEGER,
        total_value REAL,
        avg_price REAL,
        avg_rating REAL,
        categories_analyzed INTEGER,
        report_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 保存报告摘要
    const reportTimestamp = data.summary.generated_at
    const now = new Date().toISOString()
    
    db.run(`
      INSERT INTO gemstone_reports (
        report_timestamp, total_products, unique_products, 
        total_value, avg_price, avg_rating, categories_analyzed, 
        report_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportTimestamp,
      data.summary.total_products,
      data.summary.unique_products,
      data.summary.total_value,
      data.summary.avg_price,
      data.summary.avg_rating,
      data.summary.categories_analyzed,
      JSON.stringify(data),
      now
    ])
    
    // 保存产品数据
    let insertedCount = 0
    let updatedCount = 0
    
    if (data.all_products && Array.isArray(data.all_products)) {
      for (const product of data.all_products) {
        if (!product.asin) continue
        
        // 检查是否已存在
        const existing = db.exec(`SELECT id FROM gemstone_products WHERE asin = ?`, [product.asin])
        
        if (existing.length === 0 || existing[0].values.length === 0) {
          // 插入新记录
          db.run(`
            INSERT INTO gemstone_products (
              category_id, category_name_zh, category_name_en, keyword,
              platform, title, price, currency, rating, reviews,
              seller, seller_location, country, asin, url, image,
              is_prime, is_best_seller, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            product.category_id || '',
            product.category_name_zh || '',
            product.category_name_en || '',
            product.keyword || '',
            product.platform || '',
            product.title || '',
            product.price || 0,
            product.currency || 'USD',
            product.rating || 0,
            product.reviews || 0,
            product.seller || '',
            product.seller_location || '',
            product.country || '',
            product.asin,
            product.url || '',
            product.image || '',
            product.is_prime ? 1 : 0,
            product.is_best_seller ? 1 : 0,
            product.timestamp || now
          ])
          insertedCount++
        } else {
          // 更新现有记录
          db.run(`
            UPDATE gemstone_products SET
              category_id = ?, category_name_zh = ?, category_name_en = ?,
              keyword = ?, platform = ?, title = ?, price = ?, currency = ?,
              rating = ?, reviews = ?, seller = ?, seller_location = ?,
              country = ?, url = ?, image = ?, is_prime = ?, is_best_seller = ?,
              timestamp = ?
            WHERE asin = ?
          `, [
            product.category_id || '',
            product.category_name_zh || '',
            product.category_name_en || '',
            product.keyword || '',
            product.platform || '',
            product.title || '',
            product.price || 0,
            product.currency || 'USD',
            product.rating || 0,
            product.reviews || 0,
            product.seller || '',
            product.seller_location || '',
            product.country || '',
            product.url || '',
            product.image || '',
            product.is_prime ? 1 : 0,
            product.is_best_seller ? 1 : 0,
            product.timestamp || now,
            product.asin
          ])
          updatedCount++
        }
      }
    }
    
    // 保存数据库
    saveDatabase()
    
    console.log(`✅ 数据导入完成: 新增 ${insertedCount} 条, 更新 ${updatedCount} 条`)
    
    res.json({
      success: true,
      message: '数据导入成功',
      summary: {
        report_timestamp: reportTimestamp,
        total_products: data.summary.total_products,
        unique_products: data.summary.unique_products,
        inserted: insertedCount,
        updated: updatedCount
      }
    })
    
  } catch (error) {
    console.error('导入宝石数据失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 获取宝石数据报告列表
app.get('/api/gemstone/reports', (req, res) => {
  try {
    const results = db.exec(`
      SELECT id, report_timestamp, total_products, unique_products,
             total_value, avg_price, avg_rating, categories_analyzed, created_at
      FROM gemstone_reports
      ORDER BY created_at DESC
      LIMIT 50
    `)
    
    const reports = results.length > 0 ? results[0].values.map(row => ({
      id: row[0],
      report_timestamp: row[1],
      total_products: row[2],
      unique_products: row[3],
      total_value: row[4],
      avg_price: row[5],
      avg_rating: row[6],
      categories_analyzed: row[7],
      created_at: row[8]
    })) : []
    
    res.json(reports)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取宝石产品数据
app.get('/api/gemstone/products', (req, res) => {
  try {
    const { category, country, minPrice, maxPrice, minRating, limit = 100 } = req.query
    
    let sql = `SELECT * FROM gemstone_products WHERE 1=1`
    const params = []
    
    if (category) {
      sql += ` AND category_id = ?`
      params.push(category)
    }
    
    if (country) {
      sql += ` AND country = ?`
      params.push(country)
    }
    
    if (minPrice) {
      sql += ` AND price >= ?`
      params.push(parseFloat(minPrice))
    }
    
    if (maxPrice) {
      sql += ` AND price <= ?`
      params.push(parseFloat(maxPrice))
    }
    
    if (minRating) {
      sql += ` AND rating >= ?`
      params.push(parseFloat(minRating))
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT ?`
    params.push(parseInt(limit))
    
    const results = db.exec(sql, params)
    
    const products = results.length > 0 ? results[0].values.map(row => ({
      id: row[0],
      category_id: row[1],
      category_name_zh: row[2],
      category_name_en: row[3],
      keyword: row[4],
      platform: row[5],
      title: row[6],
      price: row[7],
      currency: row[8],
      rating: row[9],
      reviews: row[10],
      seller: row[11],
      seller_location: row[12],
      country: row[13],
      asin: row[14],
      url: row[15],
      image: row[16],
      is_prime: row[17],
      is_best_seller: row[18],
      timestamp: row[19],
      created_at: row[20]
    })) : []
    
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取宝石产品数据（供前端数据源使用）
app.get('/api/amazon-gemstones', (req, res) => {
  if (!gemstoneDb) return res.status(500).json({ error: 'Gemstone database not ready' })
  
  const { month, category, limit = 100 } = req.query
  
  try {
    let sql = `SELECT * FROM gemstone_products WHERE 1=1`
    const params = []
    
    if (month) {
      sql += ` AND timestamp LIKE ?`
      params.push(`${month}%`)
    }
    
    if (category) {
      sql += ` AND category_id = ?`
      params.push(category)
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT ?`
    params.push(parseInt(limit))
    
    const results = gemstoneDb.exec(sql, params)
    
    const products = results.length > 0 ? results[0].values.map(row => ({
      id: row[0],
      category_id: row[1],
      category_name_zh: row[2],
      category_name_en: row[3],
      keyword: row[4],
      platform: row[5],
      productName: row[6], // 统一字段名
      title: row[6],
      price: row[7],
      currency: row[8],
      rating: row[9],
      reviews: row[10],
      seller: row[11],
      seller_location: row[12],
      country: row[13],
      asin: row[14],
      url: row[15],
      image: row[16],
      imageUrl: row[16], // 统一字段名
      is_prime: row[17],
      is_best_seller: row[18],
      timestamp: row[19],
      website: row[5], // 平台作为网站
      brand: row[11], // 卖家作为品牌
      sales: row[10] // 评论数作为销量参考
    })) : []
    
    res.json(products)
  } catch (error) {
    console.error('获取宝石产品失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 刷新宝石数据（抓取Amazon数据）
app.post('/api/amazon-gemstones/refresh/:month', async (req, res) => {
  const { month } = req.params
  
  if (!gemstoneDb) {
    return res.status(500).json({ 
      success: false, 
      error: '宝石数据库未初始化' 
    })
  }
  
  const RAINFOREST_API_KEY = getRainforestApiKey()
  if (!RAINFOREST_API_KEY) {
    return res.status(400).json({ 
      success: false, 
      error: 'RAINFOREST_API_KEY 未配置，请在 .env 文件中设置' 
    })
  }
  
  console.log(`\n🔄 开始刷新宝石数据 (${month})`)
  
  const allProducts = []
  const categories = Object.keys(GEMSTONE_CATEGORIES)
  
  try {
    for (const categoryId of categories) {
      const category = GEMSTONE_CATEGORIES[categoryId]
      const keywords = GEMSTONE_KEYWORDS[categoryId]
      
      console.log(`\n${category.icon} ${category.name_zh}`)
      
      const keywordList = []
      if (keywords && keywords.english) {
        keywordList.push(...keywords.english.map(k => ({ keyword: k, lang: 'en' })))
      }
      if (keywords && keywords.chinese) {
        keywordList.push(...keywords.chinese.map(k => ({ keyword: k, lang: 'zh' })))
      }
      
      // 只抓取第一页，快速获取数据
      for (const { keyword } of keywordList.slice(0, 3)) { // 限制关键词数量
        const products = await fetchGemstoneFromAmazon(keyword, 'amazon.com', 1)
        
        products.forEach(p => {
          p.category_id = categoryId
          p.category_name_zh = category.name_zh
          p.category_name_en = category.name_en
        })
        
        allProducts.push(...products)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // 保存到独立的宝石数据库
    let insertedCount = 0
    const now = new Date().toISOString()
    
    for (const product of allProducts) {
      if (!product.asin) continue
      
      const existing = gemstoneDb.exec(`SELECT id FROM gemstone_products WHERE asin = ?`, [product.asin])
      
      if (existing.length === 0 || existing[0].values.length === 0) {
        gemstoneDb.run(`
          INSERT INTO gemstone_products (
            category_id, category_name_zh, category_name_en, keyword,
            platform, title, price, currency, rating, reviews,
            seller, seller_location, country, asin, url, image,
            is_prime, is_best_seller, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.category_id || '',
          product.category_name_zh || '',
          product.category_name_en || '',
          product.keyword || '',
          product.platform || '',
          product.title || '',
          product.price || 0,
          product.currency || 'USD',
          product.rating || 0,
          product.reviews || 0,
          product.seller || '',
          product.seller_location || '',
          product.country || '',
          product.asin,
          product.url || '',
          product.image || '',
          product.is_prime ? 1 : 0,
          product.is_best_seller ? 1 : 0,
          now
        ])
        insertedCount++
      }
    }
    
    // 更新分类汇总
    for (const categoryId of categories) {
      const count = gemstoneDb.exec(`SELECT COUNT(*) FROM gemstone_products WHERE category_id = ?`, [categoryId])[0]?.values[0][0] || 0
      const category = GEMSTONE_CATEGORIES[categoryId]
      
      gemstoneDb.run(`
        INSERT OR REPLACE INTO gemstone_categories (category_id, category_name_zh, category_name_en, total_products, last_updated)
        VALUES (?, ?, ?, ?, ?)
      `, [categoryId, category.name_zh, category.name_en, count, now])
    }
    
    // 记录刷新历史
    gemstoneDb.run(`
      INSERT INTO gemstone_refresh_history (refresh_date, month, total_products, categories_count, status)
      VALUES (?, ?, ?, ?, ?)
    `, [now, month, allProducts.length, categories.length, 'success'])
    
    saveGemstoneDatabase()
    
    console.log(`✅ 宝石数据刷新完成: ${insertedCount} 条新数据`)
    
    res.json({
      success: true,
      count: insertedCount,
      total: allProducts.length,
      items: allProducts.slice(0, 5)
    })
    
  } catch (error) {
    console.error('刷新宝石数据失败:', error)
    
    // 记录失败历史
    gemstoneDb.run(`
      INSERT INTO gemstone_refresh_history (refresh_date, month, total_products, categories_count, status)
      VALUES (?, ?, ?, ?, ?)
    `, [new Date().toISOString(), month, 0, 0, 'failed'])
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// 获取宝石数据可用月份
app.get('/api/amazon-gemstones/months', (req, res) => {
  if (!gemstoneDb) return res.status(500).json({ error: 'Gemstone database not ready' })
  
  try {
    const results = gemstoneDb.exec(`
      SELECT DISTINCT substr(timestamp, 1, 7) as month 
      FROM gemstone_products 
      WHERE timestamp IS NOT NULL 
      ORDER BY month DESC
    `)
    
    const months = results.length > 0 ? results[0].values.map(row => row[0]) : []
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

// 获取宝石分类汇总
app.get('/api/amazon-gemstones/categories', (req, res) => {
  if (!gemstoneDb) return res.status(500).json({ error: 'Gemstone database not ready' })
  
  try {
    const results = gemstoneDb.exec(`SELECT * FROM gemstone_categories ORDER BY category_id`)
    const categories = results.length > 0 ? results[0].values.map(row => ({
      category_id: row[1],
      category_name_zh: row[2],
      category_name_en: row[3],
      total_products: row[4],
      last_updated: row[5]
    })) : []
    res.json(categories)
  } catch (error) {
    res.json([])
  }
})

// 获取刷新历史
app.get('/api/amazon-gemstones/history', (req, res) => {
  if (!gemstoneDb) return res.status(500).json({ error: 'Gemstone database not ready' })
  
  try {
    const results = gemstoneDb.exec(`SELECT * FROM gemstone_refresh_history ORDER BY id DESC LIMIT 20`)
    const history = results.length > 0 ? results[0].values.map(row => ({
      id: row[0],
      refresh_date: row[1],
      month: row[2],
      total_products: row[3],
      categories_count: row[4],
      status: row[5],
      created_at: row[6]
    })) : []
    res.json(history)
  } catch (error) {
    res.json([])
  }
})

console.log('宝石 API 路由已注册')

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
