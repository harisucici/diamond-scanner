import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

// Simple in-memory database (for demo purposes)
let diamonds = [
  { id: 1, carat: 1.5, color: 'D', clarity: 'IF', price: 15000, created_at: new Date().toISOString() },
  { id: 2, carat: 0.8, color: 'F', clarity: 'VVS1', price: 5000, created_at: new Date().toISOString() },
  { id: 3, carat: 2.0, color: 'E', clarity: 'VVS2', price: 25000, created_at: new Date().toISOString() },
  { id: 4, carat: 1.2, color: 'G', clarity: 'VS1', price: 8000, created_at: new Date().toISOString() }
]

let nextId = 5

// ============================================
// 项链销量数据 (Necklace Sales Data)
// ============================================
let necklaceSales = [
  // 2026年1月数据
  {
    id: 1,
    rank: 1,
    month: '2026-01',
    website: 'ZOZOTOWN',
    productName: 'K18WG シンプルチェーン 40cm',
    brand: '4℃',
    priceRange: '15,000-20,000円',
    sales: 1250,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    rank: 2,
    month: '2026-01',
    website: 'ZOZOTOWN',
    productName: 'Pt950 オープンハートチェーン',
    brand: 'Cartier',
    priceRange: '80,000-100,000円',
    sales: 980,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    rank: 3,
    month: '2026-01',
    website: 'Rakuten Fashion',
    productName: 'SV925 キュビットチェーン 45cm',
    brand: 'Star Diamonds',
    priceRange: '5,000-8,000円',
    sales: 2100,
    url: 'https://rakuten.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    rank: 4,
    month: '2026-01',
    website: 'Amazon Japan',
    productName: 'K14WG 侃侃chain 40cm',
    brand: 'TIARA',
    priceRange: '12,000-15,000円',
    sales: 1850,
    url: 'https://amazon.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    rank: 5,
    month: '2026-01',
    website: '4℃',
    productName: 'K18WG マリンブルーネックレス',
    brand: '4℃',
    priceRange: '25,000-30,000円',
    sales: 780,
    url: 'https://4c.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 6,
    rank: 6,
    month: '2026-01',
    website: 'ZOZOTOWN',
    productName: 'SV925 小花モチーフチェーン',
    brand: 'AGATHA',
    priceRange: '8,000-12,000円',
    sales: 1560,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 7,
    rank: 7,
    month: '2026-01',
    website: 'Rakuten Fashion',
    productName: 'K10GG シンプルボールチェーン',
    brand: 'U-TREASURE',
    priceRange: '10,000-13,000円',
    sales: 1320,
    url: 'https://rakuten.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 8,
    rank: 8,
    month: '2026-01',
    website: 'Amazon Japan',
    productName: 'Pt950 チェーン 50cm',
    brand: 'Tiffany',
    priceRange: '150,000-200,000円',
    sales: 450,
    url: 'https://amazon.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 9,
    rank: 9,
    month: '2026-01',
    website: '4℃',
    productName: 'K18WG ハートモチーフ',
    brand: '4℃',
    priceRange: '18,000-22,000円',
    sales: 920,
    url: 'https://4c.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 10,
    rank: 10,
    month: '2026-01',
    website: 'ZOZOTOWN',
    productName: 'SV925 ヴィンテージ風チェーン',
    brand: 'LODGE',
    priceRange: '6,000-9,000円',
    sales: 1680,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  // 2026年2月数据
  {
    id: 11,
    rank: 1,
    month: '2026-02',
    website: 'Rakuten Fashion',
    productName: 'SV925 バレンタインネックレス',
    brand: 'Star Diamonds',
    priceRange: '8,000-12,000円',
    sales: 3200,
    url: 'https://rakuten.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 12,
    rank: 2,
    month: '2026-02',
    website: 'ZOZOTOWN',
    productName: 'K18WG ハート型チェーン',
    brand: '4℃',
    priceRange: '20,000-25,000円',
    sales: 2100,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 13,
    rank: 3,
    month: '2026-02',
    website: 'Amazon Japan',
    productName: 'K14WG シンプルチェーン 45cm',
    brand: 'TIARA',
    priceRange: '12,000-15,000円',
    sales: 1950,
    url: 'https://amazon.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 14,
    rank: 4,
    month: '2026-02',
    website: '4℃',
    productName: 'Pt950 オープンハート',
    brand: '4℃',
    priceRange: '90,000-110,000円',
    sales: 890,
    url: 'https://4c.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 15,
    rank: 5,
    month: '2026-02',
    website: 'ZOZOTOWN',
    productName: 'SV925 リぼんチェーン',
    brand: 'agete',
    priceRange: '15,000-18,000円',
    sales: 1420,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 16,
    rank: 6,
    month: '2026-02',
    website: 'Rakuten Fashion',
    productName: 'K10GG 小花チェーン',
    brand: 'U-TREASURE',
    priceRange: '9,000-12,000円',
    sales: 1780,
    url: 'https://rakuten.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 17,
    rank: 7,
    month: '2026-02',
    website: 'Amazon Japan',
    productName: 'Pt950 ，喜rologistチェーン',
    brand: 'Cartier',
    priceRange: '180,000-220,000円',
    sales: 380,
    url: 'https://amazon.co.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 18,
    rank: 8,
    month: '2026-02',
    website: '4℃',
    productName: 'K18WG 珊瑚モチーフ',
    brand: '4℃',
    priceRange: '22,000-28,000円',
    sales: 650,
    url: 'https://4c.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 19,
    rank: 9,
    month: '2026-02',
    website: 'ZOZOTOWN',
    productName: 'SV925 スターアクセント',
    brand: 'LODGE',
    priceRange: '7,000-10,000円',
    sales: 1920,
    url: 'https://zozo.jp/',
    created_at: new Date().toISOString()
  },
  {
    id: 20,
    rank: 10,
    month: '2026-02',
    website: 'Rakuten Fashion',
    productName: 'K14WG フルールドリーム',
    brand: 'AHKAH',
    priceRange: '35,000-45,000円',
    sales: 520,
    url: 'https://rakuten.co.jp/',
    created_at: new Date().toISOString()
  }
]

let nextNecklaceId = 21

// Initialize database (for file-based persistence)
const initDatabase = () => {
  const dbPath = path.join(__dirname, 'db', 'diamonds.json')
  
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8')
      diamonds = JSON.parse(data)
      nextId = Math.max(...diamonds.map(d => d.id), 0) + 1
      console.log('Loaded diamonds from file:', diamonds.length)
    } else {
      // Save initial data
      saveDatabase()
      console.log('Created new database with sample data')
    }
  } catch (error) {
    console.log('Using in-memory database:', error.message)
  }
  
  console.log('Database initialized successfully')
}

// Save database to file
const saveDatabase = () => {
  try {
    const dbPath = path.join(__dirname, 'db', 'diamonds.json')
    fs.writeFileSync(dbPath, JSON.stringify(diamonds, null, 2))
  } catch (error) {
    console.log('Could not save database to file:', error.message)
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  // 获取最新的项链销量月份
  const latestMonth = [...new Set(necklaceSales.map(item => item.month))].sort().reverse()[0]
  const latestMonthData = necklaceSales.filter(item => item.month === latestMonth)
  
  res.json({
    status: 'success',
    message: 'Database is connected',
    diamondsCount: diamonds.length,
    necklaceSalesCount: necklaceSales.length,
    latestNecklaceMonth: latestMonth,
    latestNecklaceTop10: latestMonthData.filter(item => item.rank <= 10).length,
    timestamp: new Date().toISOString(),
    storage: 'in-memory (JSON file persistence)'
  })
})

app.get('/api/diamonds', (req, res) => {
  res.json(diamonds)
})

app.post('/api/diamonds', (req, res) => {
  const { carat, color, clarity, price } = req.body
  
  if (!carat || !color || !clarity || !price) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  const newDiamond = {
    id: nextId++,
    carat: parseFloat(carat),
    color,
    clarity,
    price: parseInt(price),
    created_at: new Date().toISOString()
  }
  
  diamonds.unshift(newDiamond) // Add to beginning
  saveDatabase()
  
  res.json({
    ...newDiamond,
    message: 'Diamond added successfully'
  })
})

// Delete a diamond
app.delete('/api/diamonds/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const initialLength = diamonds.length
  
  diamonds = diamonds.filter(d => d.id !== id)
  
  if (diamonds.length < initialLength) {
    saveDatabase()
    res.json({ message: 'Diamond deleted successfully' })
  } else {
    res.status(404).json({ error: 'Diamond not found' })
  }
})

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    storage: 'in-memory with JSON file backup'
  })
})

// ============================================
// 项链销量 API 端点
// ============================================

// 获取所有项链销量数据
app.get('/api/necklaces', (req, res) => {
  const { month, website, brand, search, limit } = req.query
  
  let result = [...necklaceSales]
  
  // 按月份筛选
  if (month) {
    result = result.filter(item => item.month === month)
  }
  
  // 按网站筛选
  if (website) {
    result = result.filter(item => item.website.toLowerCase().includes(website.toLowerCase()))
  }
  
  // 按品牌筛选
  if (brand) {
    result = result.filter(item => item.brand.toLowerCase().includes(brand.toLowerCase()))
  }
  
  // 关键词搜索
  if (search) {
    const keyword = search.toLowerCase()
    result = result.filter(item => 
      item.productName.toLowerCase().includes(keyword) ||
      item.brand.toLowerCase().includes(keyword) ||
      item.website.toLowerCase().includes(keyword)
    )
  }
  
  // 排序（按排名）
  result.sort((a, b) => a.rank - b.rank)
  
  // 限制数量
  if (limit) {
    result = result.slice(0, parseInt(limit))
  }
  
  res.json(result)
})

// 获取可用的月份列表
app.get('/api/necklaces/months', (req, res) => {
  const months = [...new Set(necklaceSales.map(item => item.month))].sort().reverse()
  res.json(months)
})

// 获取可用的网站列表
app.get('/api/necklaces/websites', (req, res) => {
  const websites = [...new Set(necklaceSales.map(item => item.website))].sort()
  res.json(websites)
})

// 获取可用的品牌列表
app.get('/api/necklaces/brands', (req, res) => {
  const brands = [...new Set(necklaceSales.map(item => item.brand))].sort()
  res.json(brands)
})

// 获取指定月份的前十名
app.get('/api/necklaces/top10/:month', (req, res) => {
  const { month } = req.params
  const result = necklaceSales
    .filter(item => item.month === month)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
  
  res.json(result)
})

// 添加项链销量数据
app.post('/api/necklaces', (req, res) => {
  const { rank, month, website, productName, brand, priceRange, sales, url } = req.body
  
  if (!rank || !month || !website || !productName || !brand || !priceRange || !sales) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  const newNecklace = {
    id: nextNecklaceId++,
    rank: parseInt(rank),
    month,
    website,
    productName,
    brand,
    priceRange,
    sales: parseInt(sales),
    url: url || '',
    created_at: new Date().toISOString()
  }
  
  necklaceSales.unshift(newNecklace)
  
  res.json({
    ...newNecklace,
    message: 'Necklace sales data added successfully'
  })
})

// 更新项链销量数据
app.put('/api/necklaces/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const index = necklaceSales.findIndex(item => item.id === id)
  
  if (index === -1) {
    return res.status(404).json({ error: 'Necklace not found' })
  }
  
  necklaceSales[index] = {
    ...necklaceSales[index],
    ...req.body,
    id,
    updated_at: new Date().toISOString()
  }
  
  res.json({
    ...necklaceSales[index],
    message: 'Necklace sales data updated successfully'
  })
})

// 删除项链销量数据
app.delete('/api/necklaces/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const initialLength = necklaceSales.length
  
  necklaceSales = necklaceSales.filter(item => item.id !== id)
  
  if (necklaceSales.length < initialLength) {
    res.json({ message: 'Necklace sales data deleted successfully' })
  } else {
    res.status(404).json({ error: 'Necklace not found' })
  }
})

// 获取统计数据
app.get('/api/necklaces/stats/overview', (req, res) => {
  const { month } = req.query
  
  let data = necklaceSales
  if (month) {
    data = data.filter(item => item.month === month)
  }
  
  // 按网站统计销量
  const byWebsite = {}
  data.forEach(item => {
    if (!byWebsite[item.website]) {
      byWebsite[item.website] = { totalSales: 0, count: 0 }
    }
    byWebsite[item.website].totalSales += item.sales
    byWebsite[item.website].count += 1
  })
  
  // 按品牌统计销量
  const byBrand = {}
  data.forEach(item => {
    if (!byBrand[item.brand]) {
      byBrand[item.brand] = { totalSales: 0, count: 0 }
    }
    byBrand[item.brand].totalSales += item.sales
    byBrand[item.brand].count += 1
  })
  
  res.json({
    totalRecords: data.length,
    totalSales: data.reduce((sum, item) => sum + item.sales, 0),
    byWebsite,
    byBrand,
    months: [...new Set(necklaceSales.map(item => item.month))].sort().reverse()
  })
})

// Serve index.html for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Initialize database and start server
initDatabase()

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Database: in-memory with JSON file persistence`)
  console.log(`Data file: ${path.join(__dirname, 'db', 'diamonds.json')}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Total diamonds: ${diamonds.length}`)
})