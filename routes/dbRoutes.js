/**
 * LanceDB 数据库路由
 * 替代 SQLite 的所有 /api/* 路由
 */

import express from 'express'
import lancedb from '../db/lancedb.js'
import { generateEmbedding } from '../services/embeddingService.js'

const router = express.Router()

// ========== 辅助函数 ==========

/**
 * 过滤样本数据
 */
const filterSampleData = (data) => {
  return data.filter(item => !item.id || !item.id.toString().startsWith('sample_'))
}

/**
 * 构建过滤条件
 */
const buildFilter = (conditions) => {
  const parts = conditions.filter(c => c.value !== undefined && c.value !== null && c.value !== '')
  if (parts.length === 0) return null
  return parts.map(c => {
    if (c.op === 'LIKE') {
      return `${c.field} LIKE '%${c.value}%'`
    } else if (c.op === '=') {
      return `${c.field} = '${c.value}'`
    }
    return `${c.field} ${c.op} ${c.value}`
  }).join(' AND ')
}

// ========== NECKLACES 路由 ==========

/**
 * GET /api/necklaces
 * 查询配饰排行数据
 */
router.get('/necklaces', async (req, res) => {
  try {
    const { month, website, brand, search, limit } = req.query
    
    // 获取所有数据
    let data = await lancedb.queryData('necklaces')
    data = filterSampleData(data)
    
    // 过滤
    if (month) {
      data = data.filter(d => d.month === month)
    }
    if (website) {
      data = data.filter(d => d.website && d.website.includes(website))
    }
    if (brand) {
      data = data.filter(d => d.brand && d.brand.includes(brand))
    }
    if (search) {
      const s = search.toLowerCase()
      data = data.filter(d => 
        (d.productName && d.productName.toLowerCase().includes(s)) ||
        (d.brand && d.brand.toLowerCase().includes(s)) ||
        (d.website && d.website.toLowerCase().includes(s))
      )
    }
    
    // 排序
    data.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    
    // 限制
    if (limit) {
      data = data.slice(0, parseInt(limit))
    }
    
    res.json(data)
  } catch (error) {
    console.error('❌ /api/necklaces 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/months
 * 获取所有月份
 */
router.get('/necklaces/months', async (req, res) => {
  try {
    const months = await lancedb.getDistinctMonths('necklaces')
    res.json(months)
  } catch (error) {
    console.error('❌ /api/necklaces/months 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/websites
 * 获取所有网站
 */
router.get('/necklaces/websites', async (req, res) => {
  try {
    const websites = await lancedb.getDistinctWebsites('necklaces')
    res.json(websites)
  } catch (error) {
    console.error('❌ /api/necklaces/websites 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/brands
 * 获取所有品牌
 */
router.get('/necklaces/brands', async (req, res) => {
  try {
    const brands = await lancedb.getDistinctBrands('necklaces')
    res.json(brands)
  } catch (error) {
    console.error('❌ /api/necklaces/brands 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/top10/:month
 * 获取某月前10
 */
router.get('/necklaces/top10/:month', async (req, res) => {
  try {
    const { month } = req.params
    let data = await lancedb.queryData('necklaces', `month = '${month}'`)
    data = filterSampleData(data)
    data.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    res.json(data.slice(0, 10))
  } catch (error) {
    console.error('❌ /api/necklaces/top10 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/categories/:month
 * 获取某月的分类列表
 */
router.get('/necklaces/categories/:month', async (req, res) => {
  try {
    const { month } = req.params
    const categories = await lancedb.getDistinctCategories('necklaces', month)
    res.json(categories)
  } catch (error) {
    console.error('❌ /api/necklaces/categories 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/category/:month/:category
 * 获取某月某分类的数据
 */
router.get('/necklaces/category/:month/:category', async (req, res) => {
  try {
    const { month, category } = req.params
    const decodedCategory = decodeURIComponent(category)
    
    let data = await lancedb.queryData('necklaces', `month = '${month}'`)
    data = filterSampleData(data)
    data = data.filter(d => d.category && d.category.includes(decodedCategory))
    data.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    
    // 添加分类内排名
    data = data.slice(0, 10).map((item, index) => ({
      ...item,
      rank: index + 1
    }))
    
    res.json(data)
  } catch (error) {
    console.error('❌ /api/necklaces/category 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/necklaces/stats/overview
 * 统计概览
 */
router.get('/necklaces/stats/overview', async (req, res) => {
  try {
    const { month } = req.query
    
    let data = await lancedb.queryData('necklaces')
    data = filterSampleData(data)
    
    if (month) {
      data = data.filter(d => d.month === month)
    }
    
    const totalRecords = data.length
    const totalSales = data.reduce((sum, d) => sum + (d.sales || 0), 0)
    
    // 按网站统计
    const byWebsite = {}
    data.forEach(d => {
      if (!byWebsite[d.website]) {
        byWebsite[d.website] = { totalSales: 0, count: 0 }
      }
      byWebsite[d.website].totalSales += d.sales || 0
      byWebsite[d.website].count += 1
    })
    
    // 按品牌统计
    const byBrand = {}
    data.forEach(d => {
      if (!byBrand[d.brand]) {
        byBrand[d.brand] = { totalSales: 0, count: 0 }
      }
      byBrand[d.brand].totalSales += d.sales || 0
      byBrand[d.brand].count += 1
    })
    
    // 月份列表
    const allData = await lancedb.queryData('necklaces')
    const months = [...new Set(filterSampleData(allData).map(d => d.month))].sort((a, b) => b.localeCompare(a))
    
    res.json({ totalRecords, totalSales, byWebsite, byBrand, months })
  } catch (error) {
    console.error('❌ /api/necklaces/stats/overview 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

// ========== DIAMONDS 路由 ==========

/**
 * GET /api/diamonds
 * 查询钻石数据
 */
router.get('/diamonds', async (req, res) => {
  try {
    let data = await lancedb.queryData('diamonds')
    data = filterSampleData(data)
    data.sort((a, b) => (a.id || 0) - (b.id || 0))
    res.json(data)
  } catch (error) {
    console.error('❌ /api/diamonds 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/diamonds
 * 添加钻石
 */
router.post('/diamonds', async (req, res) => {
  try {
    const { carat, color, clarity, price } = req.body
    const created_at = new Date().toISOString()
    
    // 生成ID
    const existingData = await lancedb.queryData('diamonds')
    const maxId = Math.max(0, ...existingData.map(d => d.id || 0))
    const id = maxId + 1
    
    // 生成向量
    const searchText = `${carat}ct ${color} ${clarity} diamond`
    let name_vector
    try {
      name_vector = await generateEmbedding(searchText)
    } catch (e) {
      name_vector = new Array(384).fill(0)
    }
    
    const newData = {
      id,
      carat,
      color,
      clarity,
      price,
      name_vector,
      search_text: searchText,
      created_at
    }
    
    await lancedb.insertData('diamonds', [newData])
    
    res.json({ id, carat, color, clarity, price, created_at, message: 'Diamond added successfully' })
  } catch (error) {
    console.error('❌ POST /api/diamonds 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/diamonds/:id
 * 删除钻石
 */
router.delete('/diamonds/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await lancedb.deleteData('diamonds', `id = ${id}`)
    res.json({ message: 'Diamond deleted successfully' })
  } catch (error) {
    console.error('❌ DELETE /api/diamonds 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

// ========== 语义搜索增强 ==========

/**
 * POST /api/necklaces/search/semantic
 * 语义搜索配饰
 */
router.post('/necklaces/search/semantic', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }
    
    // 生成查询向量
    const queryVector = await generateEmbedding(query)
    
    // 向量搜索
    const results = await lancedb.vectorSearch('necklaces', queryVector, limit)
    
    res.json({
      query,
      results: filterSampleData(results),
      count: results.length
    })
  } catch (error) {
    console.error('❌ 语义搜索错误:', error)
    res.status(500).json({ error: error.message })
  }
})

// ========== 统计信息 ==========

/**
 * GET /api/stats
 * 获取所有表的统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await lancedb.getStats()
    res.json(stats)
  } catch (error) {
    console.error('❌ /api/stats 错误:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
