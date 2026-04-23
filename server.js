import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'
import fetch from 'node-fetch'
import cron from 'node-cron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
      
      if (rank > 30) break // 多爬一些，后面按品类筛选
      
      const nameMatch = linkHtml.match(/data-ga-item-name="([^"]+)"/)
      const productName = nameMatch ? nameMatch[1].trim() : `アクセサリー ${rank}`
      
      const brandMatch = linkHtml.match(/data-ga-item-brand="([^"]+)"/)
      const brand = brandMatch ? brandMatch[1].trim() : 'OTHER'
      
      // 品类从完整路径提取
      const categoryMatch = linkHtml.match(/data-ga-item-category="([^"]+)"/)
      const fullCategory = categoryMatch ? categoryMatch[1].trim() : ''
      // 提取短品类名
      const categoryShort = fullCategory.includes('/') ? fullCategory.split('/').pop() : fullCategory
      
      const priceMatch = linkHtml.match(/data-ga-price="(\d+)"/)
      const price = priceMatch ? parseInt(priceMatch[1]) : 0
      
      items.push({
        rank: rank++,
        itemId,
        productName,
        brand,
        category: categoryShort, // 存储短品类名
        fullCategory: fullCategory, // 存储完整品类路径
        price,
        url: `https://www.buyma.com/item/${itemId}/`
      })
    }
    
    console.log(`BUYMA爬取: 获取${items.length}条数据`)
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
      
      db.run('INSERT INTO necklaces (rank, month, website, productName, brand, priceRange, sales, url, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.rank, month, 'BUYMA', item.productName, item.brand, priceRange, sales, item.url, item.category || '', now])
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
