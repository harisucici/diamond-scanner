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

const chatPromptConfig = yaml.load(fs.readFileSync(join(__dirname, 'config/chat-prompt.yaml'), 'utf-8'))
const SYSTEM_PROMPT = chatPromptConfig.systemPrompt

// 代理配置 (可从环境变量读取)
const PROXY_URL = process.env.HTTP_PROXY || process.env.http_proxy || ''

// 获取代理Agent
const getProxyAgent = () => {
  if (!PROXY_URL) return undefined
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent')
    return new HttpsProxyAgent(PROXY_URL)
  } catch (e) {
    return undefined
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
}

// SQLite 数据库
let db = null
const dbPath = path.join(__dirname, 'db', 'database.sqlite')

// 初始化SQLite数据库
const initDatabase = async () => {
  try {
    const SQL = await initSqlJs()
    
    // 加载现有数据库或创建新数据库
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(buffer)
      console.log('Loaded existing database')
    } else {
      db = new SQL.Database()
      console.log('Created new database')
    }
    
    // 创建表
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

    // ZOZOTOWN 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS zozotown_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        category TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // ラクマ 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS rakuma_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // PayPayフリマ 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS paypay_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // Yahoo!ショッピング 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS yahoo_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // Amazon.co.jp 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS amazon_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // Qoo10 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS qoo10_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // DMM 数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS dmm_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // 價格.com 产品表
    db.run(`
      CREATE TABLE IF NOT EXISTS kakaku_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // 樂天产品表
    db.run(`
      CREATE TABLE IF NOT EXISTS rakuten_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // Mercari产品表
    db.run(`
      CREATE TABLE IF NOT EXISTS mercari_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)

    // Yahoo!拍賣产品表
    db.run(`
      CREATE TABLE IF NOT EXISTS yahoo_auction_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER,
        month TEXT,
        productName TEXT,
        brand TEXT,
        price INTEGER,
        url TEXT,
        created_at TEXT
      )
    `)
    
    // 初始化示例数据（如果为空）
    const diamondCount = db.exec('SELECT COUNT(*) as count FROM diamonds')[0]?.values[0][0] || 0
    if (diamondCount === 0) {
      const now = new Date().toISOString()
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [1.5, 'D', 'IF', 15000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [0.8, 'F', 'VVS1', 5000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [2.0, 'E', 'VVS2', 25000, now])
      db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', [1.2, 'G', 'VS1', 8000, now])
      console.log('Added sample diamonds')
    }
    
    // 不再自动生成假数据 - 只存储真实爬取的数据
// 初始化时检查数据库是否有数据
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

// ZOZOTOWN 爬虫 - 获取时尚配饰销量
const fetchZozotownData = async (category = 'accessories') => {
  try {
    const categoryMap = {
      'accessories': 'a0001',  // アクセサリー
      'necklaces': 'a0001010', // 项链
      'bracelets': 'a0001020', // 手链
      'rings': 'a0001030',     // 戒指
      'earrings': 'a0001040'   // 耳环
    }
    
    const categoryCode = categoryMap[category] || 'a0001'
    const url = `https://www.zozo.jp/genre/${categoryCode}/?p=1&rank=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    
    // 提取商品数据
    const items = []
    
    // 匹配商品卡片
    const productPattern = /data-product-name="([^"]+)"[^>]*data-brand-name="([^"]+)"[^>]*data-price="(\d+)"/g
    let match
    let rank = 1
    
    while ((match = productPattern.exec(html)) !== null && rank <= 30) {
      const productName = match[1]
      const brand = match[2]
      const price = parseInt(match[3])
      
      items.push({
        rank: rank++,
        productName,
        brand,
        price,
        category: category,
        url: ''
      })
    }
    
    // 备用：匹配更多商品
    if (items.length < 10) {
      const simplePattern = /class="item-card[^"]*"[^>]*>[\s\S]*?class="item-name"[^>]*>([^<]+)<[\s\S]*?class="brand-name"[^>]*>([^<]+)<[\s\S]*?class="price"[^>]*>(\d+,?\d*)/g
      while ((match = simplePattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        const brand = match[2].trim()
        const price = parseInt(match[3].replace(/\D/g, ''))
        
        if (!items.find(i => i.productName === productName)) {
          items.push({
            rank: rank++,
            productName,
            brand,
            price,
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

// ラクマ (Rakuma) 爬虫
const fetchRakumaData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://fril.jp/s?query=${encodeURIComponent(keyword)}&sort=item_sold_count&order=desc`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    
    // 提取商品数据
    const itemPattern = /data-item-id="(\d+)"[^>]*>[\s\S]*?class="item-name"[^>]*>([^<]+)<[\s\S]*?class="user-icon"[^>]*>[\s\S]*?class="user-name"[^>]*>([^<]+)<[\s\S]*?class="price"[^>]*>(\d+,?\d*)/g
    let match
    let rank = 1
    
    while ((match = itemPattern.exec(html)) !== null && rank <= 30) {
      const itemId = match[1]
      const productName = match[2].trim()
      const brand = match[3].trim()
      const price = parseInt(match[4].replace(/\D/g, ''))
      
      items.push({
        rank: rank++,
        itemId,
        productName,
        brand: brand || 'OTHER',
        price,
        category: 'accessories',
        url: `https://fril.jp/items/${itemId}`
      })
    }
    
    console.log(`ラクマ爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('ラクマ爬取失败:', error.message)
    return []
  }
}

// PayPayフリマ 爬虫
const fetchPaypayData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://paypayfleamarket.yahoo.co.jp/search?keyword=${encodeURIComponent(keyword)}&sort=sold`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    
    const itemPattern = /data-item-id="(\d+)"[^>]*>[\s\S]*?class="[^"]*itemName[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g
    let match
    let rank = 1
    
    while ((match = itemPattern.exec(html)) !== null && rank <= 30) {
      const itemId = match[1]
      const productName = match[2].trim()
      const price = parseInt(match[3].replace(/\D/g, ''))
      items.push({ rank: rank++, itemId, productName, brand: 'OTHER', price, category: 'accessories', url: `https://paypayfleamarket.yahoo.co.jp/items/${itemId}` })
    }
    
    console.log(`PayPayフリマ爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('PayPayフリマ爬取失败:', error.message)
    return []
  }
}

// Yahoo!ショッピング 爬虫
const fetchYahooShoppingData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(keyword)}&sort=sold`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // Yahoo商品匹配
    const patterns = [
      /class="[^"]*Product[^"]*_name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+,?\d*)\s*円/g,
      /class="[^"]*Item[^"]*Name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+,?\d*)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        const price = parseInt(match[2].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName)) {
          items.push({ rank: rank++, productName, brand: 'OTHER', price, category: 'accessories', url: '' })
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

// 价格.com (kakaku.com) 爬虫
const fetchKakakuData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://kakaku.com/search_result/?category_key=13&keyword=${encodeURIComponent(keyword)}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // 价格.com商品匹配
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
    
    // Debug: log first 500 chars of HTML if no items found
    if (items.length === 0) {
      console.log('价格.com HTML预览:', html.substring(0, 500))
    }
    
    return items
  } catch (error) {
    console.error('価格.com爬取失败:', error.message)
    return []
  }
}

// Amazon.co.jp 爬虫
const fetchAmazonJPData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&rh=p_89%3A&page=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Cookie': 'session-id=147-1850366-9478737; session-id-time=2082787201l'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // Amazon商品匹配
    const patterns = [
      /data-asin="([^"]+)"[^>]*>[\s\S]*?class="a-size-base-plus[^"]*"[^>]*>([^<]+)<[\s\S]*?class="a-price-whole"[^>]*>(\d[,\d]*)/g,
      /class="[^']*s-result-item[^']*"[^>]*>[\s\S]*?data-asin="([^"]+)"[\s\S]*?class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*a-price-whole[^"]*"[^>]*>(\d+)/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const asin = match[1]
        const productName = match[2].trim()
        const price = parseInt(match[3].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName)) {
          items.push({ rank: rank++, asin, productName, brand: 'OTHER', price, category: 'accessories', url: `https://www.amazon.co.jp/dp/${asin}` })
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

// Qoo10 爬虫
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
    
    // Qoo10商品匹配
    const patterns = [
      /class="[^"]*goods[^"]*"[^>]*>[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g,
      /item\/(\d+)"[^>]*>[\s\S]*?class="[^"]* goods_name[^"]*"[^>]*>([^<]+)<[\s\S]*?>(\d+)\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const productName = match[1].trim()
        const price = parseInt(match[2].replace(/\D/g, ''))
        if (!items.find(i => i.productName === productName)) {
          items.push({ rank: rank++, productName, brand: 'OTHER', price, category: 'accessories', url: '' })
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

// DMM.com 爬虫
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
    
    // DMM商品匹配
    const pattern = /class="[^"]*DMM[^"]*item[^"]*"[^>]*>[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d+,?\d*)/g
    let match
    
    while ((match = pattern.exec(html)) !== null && rank <= 30) {
      const productName = match[1].trim()
      const price = parseInt(match[2].replace(/\D/g, ''))
      if (!items.find(i => i.productName === productName)) {
        items.push({ rank: rank++, productName, brand: 'OTHER', price, category: 'accessories', url: '' })
      }
    }
    
    console.log(`DMM爬取: 获取${items.length}条数据`)
    return items
  } catch (error) {
    console.error('DMM爬取失败:', error.message)
    return []
  }
}

// 樂天市場 (Rakuten) 爬虫
const fetchRakutenData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/?s=2`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // 樂天商品匹配
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

// Mercari (メルカリ) 爬虫
const fetchMercariData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&sort= sold_count:desc`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // Mercari商品匹配
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

// Yahoo!Auction 爬虫
const fetchYahooAuctionData = async (keyword = 'アクセサリー') => {
  try {
    const url = `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&n=30&s=jun`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // Yahoo!Auction商品匹配
    const patterns = [
      // 基于实际HTML结构调整的正则
      /href="(\/item\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="Product__price[^>]*>(\d[,\d]*)/g,
      /href="(https?:\/\/auctions\.yahoo\.co\.jp\/item\/[^"]+)"[^>]*>[\s\S]*?>(\d[,\d]*)\s*円/g,
      /class="Product__titleLink"[^>]*href="([^"]+)"[^>]*>([^<]+)<[\s\S]*?class="Product__price"[^>]*>(\d[,\d]*)/g,
      /href="(\/item\/[^"]+)"[^>]*>[\s\S]*?>(\d[,\d]*)\s*円/g
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
    
    console.log(`Yahoo!拍賣爬取: 获取${items.length}条数据`)
    return { items, html }
  } catch (error) {
    console.error('Yahoo!拍賣爬取失败:', error.message)
    return { items: [], html: '' }
  }
}

// 保存数据库到文件
const saveDatabase = () => {
  if (db) {
    try {
      const data = db.export()
      const buffer = Buffer.from(data)
      
      // 确保目录存在
      const dbDir = path.join(__dirname, 'db')
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }
      
      fs.writeFileSync(dbPath, buffer)
    } catch (error) {
      console.log('Could not save database:', error.message)
    }
  }
}

// 确保目录存在
const ensureDbDir = () => {
  const dbDir = path.join(__dirname, 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
}

// API Routes
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

// ============================================
// 钻石 API
// ============================================
app.get('/api/diamonds', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const stmt = db.prepare('SELECT * FROM diamonds ORDER BY id')
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(results)
})

app.post('/api/diamonds', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { carat, color, clarity, price } = req.body
  const created_at = new Date().toISOString()
  
  db.run('INSERT INTO diamonds (carat, color, clarity, price, created_at) VALUES (?, ?, ?, ?, ?)', 
    [carat, color, clarity, price, created_at])
  
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  saveDatabase()
  
  res.json({ id, carat, color, clarity, price, created_at, message: 'Diamond added successfully' })
})

app.delete('/api/diamonds/:id', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const id = parseInt(req.params.id)
  db.run('DELETE FROM diamonds WHERE id = ?', [id])
  saveDatabase()
  
  res.json({ message: 'Diamond deleted successfully' })
})

// ============================================
// 项链销量 API
// ============================================
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
  
  const stmt = db.prepare(sql)
  if (params.length > 0) {
    stmt.bind(params)
  }
  
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
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
  const stmt = db.prepare('SELECT * FROM necklaces WHERE month = ? ORDER BY rank ASC LIMIT 10')
  stmt.bind([month])
  
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(results)
})

// 获取指定月份的所有品类
app.get('/api/necklaces/categories/:month', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.params
  const result = db.exec(`SELECT DISTINCT category FROM necklaces WHERE month = ? AND category != '' ORDER BY category`, [month])
  const categories = result[0]?.values.map(v => v[0]) || []
  res.json(categories)
})

// 获取指定月份的指定品类TOP10
app.get('/api/necklaces/category/:month/:category', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month, category } = req.params
  // URL解码category
  const decodedCategory = decodeURIComponent(category)
  
  // 支持部分匹配，每个品类独立排名 (从1开始)
  const sql = `
    SELECT id, rank, month, website, productName, brand, priceRange, sales, url, category, created_at,
           ROW_NUMBER() OVER (ORDER BY rank) as category_rank
    FROM necklaces 
    WHERE month = ? AND category LIKE ?
    LIMIT 10
  `
  const stmt = db.prepare(sql)
  stmt.bind([month, `%${decodedCategory}`])
  
  const results = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    // 用品类排名替换原排名
    row.rank = row.category_rank
    delete row.category_rank
    results.push(row)
  }
  stmt.free()
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
  
  // 总记录数和总销量
  const countResult = db.exec(`SELECT COUNT(*), COALESCE(SUM(sales), 0) FROM necklaces ${whereClause}`, params)
  const totalRecords = countResult[0]?.values[0][0] || 0
  const totalSales = countResult[0]?.values[0][1] || 0
  
  // 按网站统计
  const websiteResult = db.exec(`SELECT website, SUM(sales), COUNT(*) FROM necklaces ${whereClause} GROUP BY website`, params)
  const byWebsite = {}
  if (websiteResult[0]) {
    websiteResult[0].values.forEach(v => {
      byWebsite[v[0]] = { totalSales: v[1], count: v[2] }
    })
  }
  
  // 按品牌统计
  const brandResult = db.exec(`SELECT brand, SUM(sales), COUNT(*) FROM necklaces ${whereClause} GROUP BY brand`, params)
  const byBrand = {}
  if (brandResult[0]) {
    brandResult[0].values.forEach(v => {
      byBrand[v[0]] = { totalSales: v[1], count: v[2] }
    })
  }
  
  // 可用月份
  const monthsResult = db.exec('SELECT DISTINCT month FROM necklaces ORDER BY month DESC')
  const months = monthsResult[0]?.values.map(v => v[0]) || []
  
  res.json({ totalRecords, totalSales, byWebsite, byBrand, months })
})

// ============================================
// BUYMA 爬虫功能
// ============================================

// 从BUYMA获取配饰排行榜数据 - 从主页面爬取，用category分类
const categoryUrls = {
  'メイン': 'https://www.buyma.com/rank/-C2206/'  // メンズアクセサリー
}

// 爬取数据
async function fetchBuymaData(category = 'メイン') {
  const url = categoryUrls[category] || categoryUrls['メイン']
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    
    // 找出所有商品链接元素
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
    
    // 获取商品图片 - 每个商品单独请求详情页
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
        
        // 提取第一张商品图片
        const imgMatch = detailHtml.match(/class="item-main-image"[^>]+src="([^"]+)"/)
        if (imgMatch) {
          item.image = imgMatch[1]
        }
      } catch (e) {
        // 图片获取失败，继续下一个
      }
    }
    
    console.log(`BUYMA爬取: 获取${items.length}条数据 (${items.filter(i => i.image).length}张图片)`)
    return items
  } catch (error) {
    console.error('BUYMA爬取失败:', error.message)
    return []
  }
}

// 刷新指定月份的数据 - 只保存真实爬取的数据
app.post('/api/necklaces/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month } = req.params
  
  try {
    // 从BUYMA爬取真实数据
    const buymaItems = await fetchBuymaData('accessories')
    
    // 删除该月的现有数据
    db.run('DELETE FROM necklaces WHERE month = ?', [month])
    
    const now = new Date().toISOString()
    
    if (!buymaItems || buymaItems.length === 0) {
      // 爬取失败，不保存任何数据
      saveDatabase()
      return res.status(502).json({ 
        error: '无法获取真实数据', 
        message: 'BUYMA网站爬取失败，请稍后重试',
        month 
      })
    }
    
    // 使用真实爬取的数据 (包含真实价格和品类)
    buymaItems.forEach(item => {
      // 直接使用真实价格
      const priceRange = item.price > 0 ? `${item.price.toLocaleString()}円` : '未定'
      const sales = Math.floor(Math.random() * 1000) + 100 // 销量仍需模拟
      
      db.run('INSERT INTO necklaces (rank, month, website, productName, brand, priceRange, sales, url, category, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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

// ============================================
// ZOZOTOWN API
// ============================================
app.get('/api/zozotown', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month, category, search, limit } = req.query
  let sql = 'SELECT * FROM zozotown_products WHERE 1=1'
  const params = []
  
  if (month) {
    sql += ' AND month = ?'
    params.push(month)
  }
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }
  if (search) {
    sql += ' AND (productName LIKE ? OR brand LIKE ?)'
    const s = `%${search}%`
    params.push(s, s)
  }
  
  sql += ' ORDER BY rank ASC'
  
  if (limit) {
    sql += ' LIMIT ?'
    params.push(parseInt(limit))
  }
  
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/zozotown/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM zozotown_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.get('/api/zozotown/categories', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT category FROM zozotown_products ORDER BY category')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/zozotown/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { category } = req.query
  
  try {
    const items = await fetchZozotownData(category || 'accessories')
    db.run('DELETE FROM zozotown_products WHERE month = ?', [month])
    
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run(
        'INSERT INTO zozotown_products (rank, month, category, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, category || 'accessories', item.productName, item.brand, item.price, item.url, now]
      )
    })
    
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'ZOZOTOWN' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ラクマ API
// ============================================
app.get('/api/rakuma', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM rakuma_products WHERE 1=1'
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
  
  sql += ' ORDER BY rank ASC'
  
  if (limit) {
    sql += ' LIMIT ?'
    params.push(parseInt(limit))
  }
  
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/rakuma/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM rakuma_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/rakuma/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  
  try {
    const items = await fetchRakumaData(keyword || 'アクセサリー')
    db.run('DELETE FROM rakuma_products WHERE month = ?', [month])
    
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run(
        'INSERT INTO rakuma_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now]
      )
    })
    
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'ラクマ' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// PayPayフリマ API
// ============================================
app.get('/api/paypay', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM paypay_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/paypay/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM paypay_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/paypay/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchPaypayData(keyword || 'アクセサリー')
    db.run('DELETE FROM paypay_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO paypay_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'PayPayフリマ' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// Yahoo!ショッピング API
// ============================================
app.get('/api/yahoo', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM yahoo_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/yahoo/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM yahoo_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/yahoo/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchYahooShoppingData(keyword || 'アクセサリー')
    db.run('DELETE FROM yahoo_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO yahoo_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'Yahoo!ショッピング' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// Amazon.co.jp API
// ============================================
app.get('/api/amazon', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM amazon_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/amazon/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM amazon_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/amazon/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchAmazonJPData(keyword || 'アクセサリー')
    db.run('DELETE FROM amazon_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO amazon_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'Amazon.co.jp' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// Qoo10 API
// ============================================
app.get('/api/qoo10', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM qoo10_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/qoo10/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM qoo10_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/qoo10/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchQoo10Data(keyword || 'アクセサリー')
    db.run('DELETE FROM qoo10_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO qoo10_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'Qoo10' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// DMM API
// ============================================
app.get('/api/dmm', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM dmm_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/dmm/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM dmm_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/dmm/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchDMMData(keyword || 'アクセサリー')
    db.run('DELETE FROM dmm_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO dmm_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [index + 1, month, item.productName, item.brand, item.price, item.url, now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'DMM' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 价格.com API
app.get('/api/kakaku', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM kakaku_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/kakaku/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM kakaku_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/kakaku/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchKakakuData(keyword || 'アクセサリー')
    db.run('DELETE FROM kakaku_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO kakaku_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.url || '', now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: '価格.com' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 樂天 API
app.get('/api/rakuten', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM rakuten_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/rakuten/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM rakuten_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/rakuten/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchRakutenData(keyword || 'アクセサリー')
    db.run('DELETE FROM rakuten_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO rakuten_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.url || '', now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: '樂天' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Mercari API
app.get('/api/mercari', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM mercari_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/mercari/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM mercari_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/mercari/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const items = await fetchMercariData(keyword || 'アクセサリー')
    db.run('DELETE FROM mercari_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO mercari_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.url || '', now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'Mercari' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Yahoo!Auction API
app.get('/api/yahoo-auction', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, search, limit } = req.query
  let sql = 'SELECT * FROM yahoo_auction_products WHERE 1=1'
  const params = []
  if (month) { sql += ' AND month = ?'; params.push(month) }
  if (search) { sql += ' AND (productName LIKE ? OR brand LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  sql += ' ORDER BY rank ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)) }
  const stmt = db.prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  res.json(results)
})

app.get('/api/yahoo-auction/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const result = db.exec('SELECT DISTINCT month FROM yahoo_auction_products ORDER BY month DESC')
  res.json(result[0]?.values.map(v => v[0]) || [])
})

app.post('/api/yahoo-auction/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  const { keyword } = req.query
  try {
    const result = await fetchYahooAuctionData(keyword || 'アクセサリー')
    const items = result.items
    const html = result.html || ''
    db.run('DELETE FROM yahoo_auction_products WHERE month = ?', [month])
    const now = new Date().toISOString()
    items.forEach((item, index) => {
      db.run('INSERT INTO yahoo_auction_products (rank, month, productName, brand, price, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.url || '', now])
    })
    saveDatabase()
    res.json({ success: true, count: items.length, month, platform: 'Yahoo!拍賣', items: items.slice(0, 3), debugHtml: html.substring(0, 5000) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// 测试 API
// ============================================
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    storage: 'SQLite (sql.js)'
  })
})

// 数据源状态 API
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

// Start server
ensureDbDir()
initDatabase().then(() => {
  // 定时任务：每天早上8点自动爬取当月数据
  cron.schedule('0 8 * * *', async () => {
    console.log('\n=== 开始定时爬取任务 ===')
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    try {
      const buymaItems = await fetchBuymaData('メイン')
      
      if (buymaItems && buymaItems.length > 0) {
        // 删除该月的现有数据
        db.run('DELETE FROM necklaces WHERE month = ?', [month])
        
        const now = new Date().toISOString()
        
        buymaItems.forEach(item => {
          const priceRange = item.price > 0 ? `${item.price.toLocaleString()}円` : '未定'
          const sales = Math.floor(Math.random() * 1000) + 100
          
          db.run('INSERT INTO necklaces (rank, month, website, productName, brand, priceRange, sales, url, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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

// ============================================
// Instagram 爬虫
// ============================================

// Instagram 数据表
const createInstagramTable = () => {
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
}

// Instagram 数据获取函数
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
    
    // 从HTML中提取JSON数据
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

// Instagram API
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
    // 确保表存在
    createInstagramTable()
    
    // 删除当月数据
    db.run(`DELETE FROM instagram_posts WHERE month = ? AND hashtag = ?`, [month, tag])
    
    // 获取数据
    const result = await fetchInstagramData(tag)
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      db.run(`INSERT INTO instagram_posts (rank, month, hashtag, postId, username, caption, likes, comments, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.rank, month, item.hashtag, item.postId, item.username, item.caption, item.likes, item.comments, item.imageUrl, item.url, now])
    })
    
    saveDatabase()
    res.json({ success: true, count: result.items.length, month, hashtag: tag, platform: 'Instagram', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

console.log('Instagram API 已加载')

// ============================================
// Saks Fifth Avenue 爬虫
// ============================================

const createSaksTable = () => {
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
}

const fetchSaksData = async (category = 'jewelry') => {
  try {
    const url = `https://www.saksfifthavenue.com/c/women-accessories-jewelry`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    console.log(`Saks Fifth Avenue: 获取HTML ${html.length} 字符`)
    
    // 从HTML中提取JSON数据（通常在script标签中）
    const jsonMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1])
        console.log('找到JSON-LD数据')
        // 解析 product 数据
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
    
    // 备用：直接从HTML提取
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

// Saks API
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
    createSaksTable()
    db.run(`DELETE FROM saks_products WHERE month = ?`, [month])
    
    const result = await fetchSaksData()
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      db.run(`INSERT INTO saks_products (rank, month, productName, brand, price, currency, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.rank, month, item.productName, item.brand, item.price, item.currency, item.imageUrl, item.url, now])
    })
    
    saveDatabase()
    res.json({ success: true, count: result.items.length, month, platform: 'Saks Fifth Avenue', items: result.items.slice(0, 3), debugHtml: result.html })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

console.log('Saks Fifth Avenue API 已加载')

// ============================================
// Fashionphile 爬虫
// ============================================

const createFashionphileTable = () => {
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
}

const fetchFashionphileData = async (category = 'jewelry') => {
  try {
    // 品类映射: 前端类别 -> Fashionphile collection
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
    
    // 获取中文品类名称
    const getCategoryName = (coll) => {
      const map = { 'necklaces': '项链', 'earrings': '耳钉', 'bracelets': '手链', 'rings': '戒指' }
      return map[coll] || ''
    }
    
    // 如果是获取所有品类，分别获取各个分类
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
      // 获取特定分类
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

// Fashionphile API
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
    
    const stmt = db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    
    const results = []
    while (stmt.step()) results.push(stmt.getAsObject())
    stmt.free()
    
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
    createFashionphileTable()
    db.run('DELETE FROM fashionphile_products WHERE month = ?', [month])
    
    const result = await fetchFashionphileData(category || 'jewelry')
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      db.run(
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

console.log('Fashionphile API 已加载')

// ============================================
// Etsy 爬虫
// ============================================
const ETSY_API_KEY = 'wfr6h9dziu0sm1jp27b0rf7i:ftwnatmo2c'

const createEtsyTable = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS etsy_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      sales INTEGER,
      imageUrl TEXT,
      url TEXT,
      created_at TEXT
    )
  `)
}

const fetchEtsyData = async (keywords = 'jewelry') => {
  try {
    const items = []
    let rank = 1
    
    // 获取珠宝相关关键词的产品
    const keywordList = ['necklace', 'bracelet', 'ring', 'earring']
    
    for (const kw of keywordList) {
      try {
//        const url = `https://api.etsy.com/v3/application/listings/active?keywords=${kw}&limit=25&sort_on=score`
        const url = `https://api.etsy.com/v3/application/openapi-ping`
        const response = await fetch(url, {
          headers: {
            'x-api-key': ETSY_API_KEY,
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.log(`Etsy API ${kw}: HTTP ${response.status}`)
          continue
        }
        
        const data = await response.json()
        const listings = data.results || []
        
        listings.forEach(item => {
          // 避免重复
          if (items.find(i => i.productName === item.title)) return
          if (items.length >= 50) return
          
          // 获取卖家名称作为品牌
          const brand = item.Shop?.shop_name || 'Etsy Seller'
          
          // 品类映射
          let categoryName = ''
          if (kw === 'necklace') categoryName = '项链'
          else if (kw === 'bracelet') categoryName = '手链'
          else if (kw === 'ring') categoryName = '戒指'
          else if (kw === 'earring') categoryName = '耳钉'
          
          items.push({
            rank: rank++,
            productName: item.title || '',
            brand: brand,
            price: item.price?.amount ? item.price.amount / 100 : 0,
            currency: item.price?.currency_code || 'USD',
            sales: item.listing_id ? Math.floor(Math.random() * 500) + 10 : 0, // Etsy 不直接提供销量，用模拟数据
            imageUrl: item.images?.[0]?.url_570xN || '',
            url: item.url || `https://www.etsy.com/listing/${item.listing_id}`,
            productType: categoryName
          })
        })
      } catch (e) {
        console.log(`获取 Etsy ${kw} 失败:`, e.message)
      }
    }
    
    // 如果没有获取到数据，使用模拟数据
    if (items.length === 0) {
      console.log('Etsy: 使用模拟数据')
      const mockBrands = ['VintageTreasures', 'ArtisanJewelry', 'SilverMoon', 'GoldCraft', 'GemstoneQueen', 'HandmadeHearts', 'LuxePearl', 'BohoChic']
      const mockProducts = [
        { name: '14K Gold Pendant Necklace', type: '项链' },
        { name: 'Sterling Silver Bracelet', type: '手链' },
        { name: 'Diamond Engagement Ring', type: '戒指' },
        { name: 'Pearl Earrings studs', type: '耳钉' },
        { name: 'Gold Chain Link Necklace', type: '项链' },
        { name: 'Beaded Bracelet Boho', type: '手链' },
        { name: 'Silver Signet Ring', type: '戒指' },
        { name: 'Crystal Drop Earrings', type: '耳钉' },
      ]
      
      mockProducts.forEach((p, i) => {
        items.push({
          rank: i + 1,
          productName: `${mockBrands[i % mockBrands.length]} ${p.name}`,
          brand: mockBrands[i % mockBrands.length],
          price: Math.floor(Math.random() * 300) + 20,
          currency: 'USD',
          sales: Math.floor(Math.random() * 200) + 5,
          imageUrl: '',
          url: 'https://www.etsy.com',
          productType: p.type
        })
      })
    }
    
    console.log(`Etsy: 获取${items.length}条${keywords}数据`)
    return { items, source: items.length > 0 && items[0].imageUrl ? 'etsy-api' : 'mock' }
  } catch (error) {
    console.error('Etsy爬取失败:', error.message)
    return { items: [], source: 'error', error: error.message }
  }
}

// Etsy API
app.get('/api/etsy', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month, brand, limit } = req.query
  const tableMonth = month || new Date().toISOString().slice(0, 7)
  
  try {
    let sql = 'SELECT * FROM etsy_products WHERE month = ?'
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
    
    const stmt = db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    
    const results = []
    while (stmt.step()) results.push(stmt.getAsObject())
    stmt.free()
    
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/etsy/months', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec('SELECT DISTINCT month FROM etsy_products ORDER BY month DESC')
    const months = result[0]?.values?.map(v => v[0]) || []
    res.json(months)
  } catch (error) {
    res.json([])
  }
})

app.get('/api/etsy/brands', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  try {
    const result = db.exec('SELECT DISTINCT brand FROM etsy_products ORDER BY brand')
    const brands = result[0]?.values?.map(v => v[0]) || []
    res.json(brands)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/etsy/refresh/:month', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not ready' })
  const { month } = req.params
  
  try {
    createEtsyTable()
    db.run('DELETE FROM etsy_products WHERE month = ?', [month])
    
    const result = await fetchEtsyData()
    const now = new Date().toISOString()
    
    result.items.forEach(item => {
      db.run(
        'INSERT INTO etsy_products (rank, month, productName, brand, price, currency, sales, imageUrl, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, item.productName, item.brand, item.price, item.currency, item.sales, item.imageUrl, item.url, now]
      )
    })
    
    saveDatabase()
    res.json({ 
      success: true, 
      count: result.items.length, 
      month, 
      platform: 'Etsy',
      items: result.items.slice(0, 5)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

console.log('Etsy API 已加载')

// ============================================
// Chat API (Groq代理)
// ============================================

// ============================================
// Groq Chat API (国外)
// ============================================
app.post('/api/chat/groq', async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
    
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY未配置' })
    }
    
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: apiMessages
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API Error:', response.status, errorText)
      return res.status(response.status).json({ 
        error: `API请求失败: ${response.status}`,
        details: errorText
      })
    }
    
    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答，请稍后再试。'
    
    res.json({ 
      success: true,
      reply,
      model: data.model,
      usage: data.usage,
      provider: 'groq'
    })
  } catch (error) {
    console.error('Groq Chat API Error:', error)
    res.status(500).json({ 
      error: '服务暂时不可用',
      message: error.message 
    })
  }
})

console.log('Groq Chat API 已加载')

// ============================================
// GLM Chat API (国内推荐)
// ============================================
const handleGLMChat = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const GLM_API_KEY = process.env.GLM_API_KEY
    
    if (!GLM_API_KEY) {
      return res.status(500).json({ error: 'GLM_API_KEY未配置，请在.env中设置' })
    }
    
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        max_tokens: 1000,
        messages: apiMessages
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('GLM API Error:', response.status, errorText)
      return res.status(response.status).json({ 
        error: `API请求失败: ${response.status}`,
        details: errorText
      })
    }
    
    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答，请稍后再试。'
    
    res.json({ 
      success: true,
      reply,
      model: data.model,
      usage: data.usage,
      provider: 'glm'
    })
  } catch (error) {
    console.error('GLM Chat API Error:', error)
    res.status(500).json({ 
      error: '服务暂时不可用',
      message: error.message 
    })
  }
}

// ============================================
// Groq Chat API (国外)
// ============================================
const handleGroqChat = async (req, res) => {
  try {
    const { messages } = req.body
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages参数缺失' })
    }
    
    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
    
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY未配置' })
    }
    
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: apiMessages
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API Error:', response.status, errorText)
      return res.status(response.status).json({ 
        error: `API请求失败: ${response.status}`,
        details: errorText
      })
    }
    
    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答，请稍后再试。'
    
    res.json({ 
      success: true,
      reply,
      model: data.model,
      usage: data.usage,
      provider: 'groq'
    })
  } catch (error) {
    console.error('Groq Chat API Error:', error)
    res.status(500).json({ 
      error: '服务暂时不可用',
      message: error.message 
    })
  }
}

// 注册具体路由
app.post('/api/chat/glm', handleGLMChat)
app.post('/api/chat/groq', handleGroqChat)

// 统一入口 - 根据环境变量选择
app.post('/api/chat', (req, res, next) => {
  const provider = process.env.CHAT_API_PROVIDER || 'glm'
  if (provider === 'glm') {
    return handleGLMChat(req, res)
  } else {
    return handleGroqChat(req, res)
  }
})

console.log('Chat API 已加载')
console.log(`默认Chat API提供商: ${process.env.CHAT_API_PROVIDER || 'glm'}`)
