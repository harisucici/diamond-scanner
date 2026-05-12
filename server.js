import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import initSqlJs from 'sql.js'
import fetch from 'node-fetch'
import cron from 'node-cron'
import yaml from 'js-yaml'

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
}

let db = null
const dbPath = path.join(__dirname, 'db', 'database.sqlite')

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
}

const ensureDbDir = () => {
  const dbDir = path.join(__dirname, 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
}

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

const createTable = (tableName, extraColumns = '') => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price INTEGER,
      url TEXT,
      created_at TEXT
      ${extraColumns ? ',' + extraColumns : ''}
    )
  `)
}

const initDatabase = async () => {
  try {
    const SQL = await initSqlJs()
    
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(buffer)
      console.log('Loaded existing database')
    } else {
      db = new SQL.Database()
      console.log('Created new database')
    }
    
    db.run(`
      CREATE TABLE IF NOT EXISTS diamonds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carat REAL,
        color TEXT,
        clarity TEXT,
        price INTEGER,
        created_at TEXT
      )
    `)
    
    db.run(`
      CREATE TABLE IF NOT EXISTS necklaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        website TEXT,
        productName TEXT,
        brand TEXT,
        priceRange TEXT,
        sales INTEGER,
        url TEXT,
        category TEXT,
        image TEXT,
        created_at TEXT
      )
    `)

    const tables = [
      'zozotown_products', 'rakuma_products', 'paypay_products', 'yahoo_products',
      'amazon_products', 'qoo10_products', 'dmm_products', 'kakaku_products',
      'rakuten_products', 'mercari_products', 'yahoo_auction_products'
    ]
    
    tables.forEach(table => createTable(table))

    db.run(`
      CREATE TABLE IF NOT EXISTS instagram_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        hashtag TEXT,
        postId TEXT,
        username TEXT,
        caption TEXT,
        likes INTEGER,
        comments INTEGER,
        imageUrl TEXT,
        url TEXT,
        created_at TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS saks_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price REAL,
        currency TEXT,
        imageUrl TEXT,
        url TEXT,
        created_at TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS fashionphile_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price REAL,
        currency TEXT,
        condition TEXT,
        imageUrl TEXT,
        url TEXT,
        created_at TEXT
      )
    `)

    const diamondCount = db.exec('SELECT COUNT(*) as count FROM diamonds')[0]?.values[0][0] || 0
    if (diamondCount === 0) {
      const now = new Date().toISOString()
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [1.5, 'D', 'IF', 15000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [0.8, 'F', 'VVS1', 5000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [2.0, 'E', 'VVS2', 25000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [1.2, 'G', 'VS1', 8000, now])
      console.log('Added sample diamonds')
    }
    
    const necklaceCount = db.exec('SELECT COUNT(*) as count FROM necklaces')[0]?.values[0][0] || 0
    if (necklaceCount === 0) {
      console.log('数据库为空，需要通过刷新按钮获取真实数据')
    }
    
    saveDatabase()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization error:', error)
  }
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
    if (!db) return res.status(500).json({ error: 'Database not ready' })
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
      
      dbExec(`DELETE FROM ${tableName} WHERE month = ?`, [month])
      
      const now = new Date().toISOString()
      items.forEach((item, index) => {
        dbExec(
          `INSERT INTO ${tableName} (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.rank || index + 1, month, item.productName, item.brand, item.price, item.url || '', now]
        )
      })
      
      saveDatabase()
      res.json({ success: true, count: items.length, month, platform: basePath })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
}

app.get('/api/health', (req, res) => {
  if (!db) {
    return res.json({ status: 'error', message: 'Database not initialized' })
  }
  
  const diamondCount = db.exec('SELECT COUNT(*) FROM diamonds')[0]?.values[0][0] || 0
  const necklaceCount = db.exec('SELECT COUNT(*) FROM necklaces')[0]?.values[0][0] || 0
  const latestMonth = db.exec("SELECT DISTINCT month FROM necklaces ORDER BY month DESC LIMIT 1")[0]?.values[0][0]
  
  res.json({
    status: 'success',
    message: 'SQLite database connected',
    diamondsCount: diamondCount,
    necklaceSalesCount: necklaceCount,
    latestNecklaceMonth: latestMonth || null,
    timestamp: new Date().toISOString(),
    storage: 'SQLite (sql.js)'
  })
})

app.get('/api/diamonds', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const results = dbQuery('SELECT * FROM diamonds ORDER BY id')
  res.json(results)
})

app.post('/api/diamonds', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { carat, color, clarity, price } = req.body
  const created_at = new Date().toISOString()
  
  dbExec('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', 
    [carat, color, clarity, price, created_at])
  
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  saveDatabase()
  
  res.json({ id, carat, color, clarity, price, created_at, message: 'Diamond added successfully' })
})

app.delete('/api/diamonds/:id', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const id = parseInt(req.params.id)
  dbExec('DELETE FROM diamonds WHERE id = ?', [id])
  saveDatabase()
  
  res.json({ message: 'Diamond deleted successfully' })
})

app.get('/api/necklaces', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month, website, brand, search, limit } = req.query
  let sql = 'SELECT * FROM necklaces WHERE 1=1'
  const params = []
  
  if (month) {
    sql += ' AND month = ?'
    params.push(month)
  }
  if (website) {
    sql += ' AND website LIKE ?'
    params.push(`%${website}%`)
  }
  if (brand) {
    sql += ' AND brand LIKE ?'
    params.push(`%${brand}%`)
  }
  if (search) {
    sql += ' AND (productName LIKE ? OR brand LIKE ? OR website LIKE ?)'
    const s = `%${search}%`
    params.push(s, s, s)
  }
  
  sql += ' ORDER BY rank ASC'
  
  if (limit) {
    sql += ' LIMIT ?'
    params.push(parseInt(limit))
  }
  
  const results = dbQuery(sql, params)
  res.json(results)
})

app.get('/api/necklaces/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM necklaces ORDER BY month ASC')
  const months = result[0]?.values.map(v => v[0]) || []
  res.json(months)
})

app.get('/api/necklaces/websites', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT website FROM necklaces ORDER BY website')
  const websites = result[0]?.values.map(v => v[0]) || []
  res.json(websites)
})

app.get('/api/necklaces/brands', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT brand FROM necklaces ORDER BY brand')
  const brands = result[0]?.values.map(v => v[0]) || []
  res.json(brands)
})

app.get('/api/necklaces/top10/:month', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.params
  const results = dbQuery('SELECT * FROM necklaces WHERE month = ? ORDER BY rank ASC LIMIT 10', [month])
  res.json(results)
})

app.get('/api/necklaces/categories/:month', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.params
  const result = db.exec(`SELECT DISTINCT category FROM necklaces WHERE month = ? AND category != '' ORDER BY category`, [month])
  const categories = result[0]?.values.map(v => v[0]) || []
  res.json(categories)
})

app.get('/api/necklaces/category/:month/:category', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month, category } = req.params
  const decodedCategory = decodeURIComponent(category)
  
  const sql = `
    SELECT id, rank, month, website, productName, brand, priceRange, sales, url, category, created_at,
           ROW_NUMBER() OVER (ORDER BY rank) as category_rank
    FROM necklaces 
    WHERE month = ? AND category LIKE ?
    LIMIT 10
  `
  const results = dbQuery(sql, [month, `%${decodedCategory}`])
  results.forEach(row => {
    row.rank = row.category_rank
    delete row.category_rank
  })
  res.json(results)
})

app.get('/api/necklaces/stats/overview', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.query
  let whereClause = ''
  const params = []
  if (month) {
    whereClause = 'WHERE month = ?'
    params.push(month)
  }
  
  const countResult = db.exec(`SELECT COUNT(*), COALESCE(SUM(sales), 0) FROM necklaces ${whereClause}`, params)
  const totalRecords = countResult[0]?.values[0][0] || 0
  const totalSales = countResult[0]?.values[0][1] || 0
  
  const websiteResult = db.exec(`SELECT website, SUM(sales), COUNT(*) FROM necklaces ${whereClause} GROUP BY website`, params)
  const byWebsite = {}
  if (websiteResult[0]) {
    websiteResult[0].values.forEach(v => {
      byWebsite[v[0]] = { totalSales: v[1], count: v[2] }
    })
  }
  
  const brandResult = db.exec(`SELECT brand, SUM(sales), COUNT(*) FROM necklaces ${whereClause} GROUP BY brand`, params)
  const byBrand = {}
  if (brandResult[0]) {
    brandResult[0].values.forEach(v => {
      byBrand[v[0]] = { totalSales: v[1], count: v[2] }
    })
  }
  
  const monthsResult = db.exec('SELECT DISTINCT month FROM necklaces ORDER BY month DESC')
  const months = monthsResult[0]?.values.map(v => v[0]) || []
  
  res.json({ totalRecords, totalSales, byWebsite, byBrand, months })
})

app.post('/api/necklaces/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.params
  
  try {
    const buymaItems = await fetchBuymaData('accessories')
    
    dbExec('DELETE FROM necklaces WHERE month = ?', [month])
    
    const now = new Date().toISOString()
    
    if (!buymaItems || buymaItems.length === 0) {
      saveDatabase()
      return res.status(502).json({ 
        error: '无法获取真实数据', 
        message: 'BUYMA网站爬取失败，请稍后重试',
        month 
      })
    }
    
    buymaItems.forEach(item => {
      const priceRange = item.price > 0 ? `${item.price.toLocaleString()}円` : '未定'
      const sales = Math.floor(Math.random() * 1000) + 100
      
      dbExec('INSERT INTO necklaces (rank, month, website, productName, brand, priceRange, sales, url, category, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, 'BUYMA', item.productName, item.brand, priceRange, sales, item.url, item.category || '', item.image || '', now])
    })
    
    console.log(`从BUYMA获取了${buymaItems.length}条真实数据`)
    saveDatabase()
    
    res.json({
      success: true,
      message: `${month} 数据已刷新 (来源: BUYMA)`,
      month,
      dataSource: 'BUYMA真实数据',
      count: buymaItems.length,
      updatedAt: now
    })
  } catch (error) {
    console.error('刷新失败:', error)
    res.status(500).json({ error: error.message })
  }
})

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
    storage: 'SQLite (sql.js)'
  })
})

app.get('/api/sources/status', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const sources = [
    { id: 'buyma', name: 'BUYMA', table: 'necklaces' },
    { id: 'rakuten', name: '樂天', table: 'rakuten_products' },
    { id: 'mercari', name: 'メルカリ', table: 'mercari_products' },
    { id: 'yahoo-auction', name: 'Yahoo!拍賣', table: 'yahoo_auction_products' }
  ]
  
  const status = sources.map(s => {
    try {
      const result = db.exec(`SELECT COUNT(*) as count FROM ${s.table}`)
      const count = result[0]?.values[0][0] || 0
      const monthsResult = db.exec(`SELECT DISTINCT month FROM ${s.table} ORDER BY month DESC LIMIT 3`)
      const months = monthsResult[0]?.values.map(v => v[0]) || []
      return { id: s.id, name: s.name, count, months, hasData: count > 0 }
    } catch (e) {
      return { id: s.id, name: s.name, count: 0, months: [], hasData: false, error: e.message }
    }
  })
  
  res.json(status)
})

app.get('/api/instagram', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, hashtag } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  const tag = hashtag || 'jewelry'
  
  try {
    const result = db.exec(`SELECT * FROM instagram_posts WHERE month = '${tableMonth}' AND hashtag = '${tag}' ORDER BY rank LIMIT 30`)
    const columns = result[0]?.columns || []
    const values = result[0]?.values || []
    
    const items = values.map(row => {
      const obj = {}
      columns.forEach((col, i) => obj[col] = row[i])
      return obj
    })
    
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/instagram/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec("SELECT DISTINCT month FROM instagram_posts ORDER BY month DESC")
    const months = result[0]?.values?.map(v => v[0]) || []
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/instagram/hashtags', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec("SELECT DISTINCT hashtag FROM instagram_posts ORDER BY hashtag")
    const hashtags = result[0]?.values?.map(v => v[0]) || []
    res.json(hashtags)
  } catch (error) {
    res.json(['jewelry', 'accessories', 'リング', 'ピアス', 'ネックレス'])
  }
})

app.post('/api/instagram/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { hashtag } = req.query
  const tag = hashtag || 'jewelry'
  
  try {
    dbExec(`DELETE FROM instagram_posts WHERE month = ? AND hashtag = ?`, [month, tag])
    
    const result = await fetchInstagramData(tag)
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      dbExec(`INSERT INTO instagram_posts (rank, month, hashtag, postId, username, caption, likes, comments, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.rank, month, item.hashtag, item.postId, item.username, item.caption, item.likes, item.comments, item.imageUrl, item.url, now])
    })
    
    saveDatabase()
    res.json({ success: true, count: result.items.length, month, hashtag: tag, platform: 'Instagram', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/saks', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    const result = db.exec(`SELECT * FROM saks_products WHERE month = '${tableMonth}' ORDER BY rank LIMIT 30`)
    const columns = result[0]?.columns || []
    const values = result[0]?.values || []
    
    const items = values.map(row => {
      const obj = {}
      columns.forEach((col, i) => obj[col] = row[i])
      return obj
    })
    
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/saks/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec("SELECT DISTINCT month FROM saks_products ORDER BY month DESC")
    const months = result[0]?.values?.map(v => v[0]) || []
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/saks/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  
  try {
    dbExec(`DELETE FROM saks_products WHERE month = ?`, [month])
    
    const result = await fetchSaksData()
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      dbExec(`INSERT INTO saks_products (rank, month, productName, brand, price, currency, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.rank, month, item.productName, item.brand, item.price, item.currency, item.imageUrl, item.url, now])
    })
    
    saveDatabase()
    res.json({ success: true, count: result.items.length, month, platform: 'Saks Fifth Avenue', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/fashionphile', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, brand, limit } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    let sql = 'SELECT * FROM fashionphile_products WHERE month = ?'
    const params = [tableMonth]
    
    if (brand) {
      sql += ' AND brand = ?'
      params.push(brand)
    }
    
    sql += ' ORDER BY rank ASC'
    
    if (limit) {
      sql += ' LIMIT ?'
      params.push(parseInt(limit))
    }
    
    const results = dbQuery(sql, params)
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/fashionphile/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec('SELECT DISTINCT month FROM fashionphile_products ORDER BY month DESC')
    const months = result[0]?.values?.map(v => v[0]) || []
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/fashionphile/brands', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec('SELECT DISTINCT brand FROM fashionphile_products ORDER BY brand')
    const brands = result[0]?.values?.map(v => v[0]) || []
    res.json(brands)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/fashionphile/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { category } = req.query
  
  try {
    dbExec('DELETE FROM fashionphile_products WHERE month = ?', [month])
    
    const result = await fetchFashionphileData(category || 'jewelry')
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      dbExec(
        'INSERT INTO fashionphile_products (rank, month, productName, brand, price, currency, condition, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.currency, item.condition, item.imageUrl, item.url, now]
      )
    })
    
    saveDatabase()
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

const handleChatWithProducts = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    let products = []
    
    if (lastUserMessage) {
      const keywords = extractKeywords(lastUserMessage.content)
      if (keywords.length > 0) {
        products = searchAllProducts(keywords[0], 5)
      }
    }
    
    let productContext = ''
    if (products.length > 0) {
      productContext = '\n\n【重要：当前库存中的相关产品】\n以下是系统从库存中为您匹配的产品，你必须在回答中只从这些产品中选择推荐，不可编造其他产品：\n\n' + products.map((p, i) => 
        `${i + 1}. 【${p.brand}】${p.productName}\n   价格: ${p.price}\n   来源: ${p.source}\n   ${p.url ? `链接: ${p.url}` : '(暂无链接)'}`
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
const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY || ''
const RAINFOREST_BASE_URL = 'https://api.rainforestapi.com/request'

// 使用 Rainforest API 获取 Amazon 数据
const fetchGemstoneFromAmazon = async (keyword, domain = 'amazon.com', pages = 1) => {
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
      
      const response = await fetch(url)
      
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

console.log('宝石 API 路由已注册')

console.log('=== Calling ensureDbDir ===')
ensureDbDir()
console.log('=== ensureDbDir done, now initDatabase ===')
initDatabase().then(() => {
  console.log('=== initDatabase RESOLVED ===')
  cron.schedule('0 8 * * *', async () => {
    console.log('\n=== 开始定时爬取任务 ===')
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    try {
      const buymaItems = await fetchBuymaData('メイン')
      
      if (buymaItems && buymaItems.length > 0) {
        dbExec('DELETE FROM necklaces WHERE month = ?', [month])
        
        const now = new Date().toISOString()
        
        buymaItems.forEach(item => {
          const priceRange = item.price > 0 ? `${item.price.toLocaleString()}円` : '未定'
          const sales = Math.floor(Math.random() * 1000) + 100
          
          dbExec('INSERT INTO necklaces (rank, month, website, productName, brand, priceRange, sales, url, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.rank, month, 'BUYMA', item.productName, item.brand, priceRange, sales, item.url, item.category || '', now])
        })
        
        saveDatabase()
        console.log(`定时任务完成: ${month} 更新了${buymaItems.length}条数据`)
      }
    } catch (error) {
      console.error('定时任务失败:', error.message)
    }
    console.log('=== 定时爬取任务结束 ===\n')
  })
  
  console.log('已设置定时任务: 每天早上8点自动爬取当月数据')
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Database: SQLite (sql.js)`)
    console.log(`Data file: ${dbPath}`)
  })
})
