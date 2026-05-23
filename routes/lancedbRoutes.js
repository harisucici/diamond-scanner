/**
 * LanceDB 向量搜索 API 路由
 */

import express from 'express'
import { getTable, vectorSearch, insertData, TABLES, getStats, cleanSampleData } from '../db/lancedb.js'
import { generateEmbedding, cosineSimilarity } from '../services/embeddingService.js'

const router = express.Router()

/**
 * GET /api/lancedb/stats
 * 获取 LanceDB 统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats()
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/lancedb/search/semantic
 * 语义搜索产品
 * Body: { query: string, limit?: number, platform?: string, category?: string }
 */
router.post('/search/semantic', async (req, res) => {
  try {
    const { query, limit = 10, platform, category } = req.body
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required'
      })
    }
    
    // 智能提取类别关键词
    const categoryKeywords = {
      '耳环': ['耳环', 'イヤリング', 'earring', 'piercing', 'ピアス'],
      '项链': ['项链', 'ネックレス', 'necklace', 'チェーン', 'chain'],
      '手链': ['手链', 'ブレスレット', 'bracelet', 'バングル', 'bangle'],
      '戒指': ['戒指', 'リング', 'ring', '指輪'],
      '手表': ['手表', '腕時計', 'watch', '時計'],
      '包包': ['包包', 'バッグ', 'bag', 'トート', 'ショルダー'],
      '太阳镜': ['太阳镜', 'サングラス', 'sunglass', 'メガネ', '眼镜']
    }
    
    // 从查询中检测类别
    let detectedCategory = category
    if (!detectedCategory) {
      const queryLower = query.toLowerCase()
      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => queryLower.includes(kw))) {
          detectedCategory = cat
          break
        }
      }
    }
    
    // 生成查询向量
    const queryVector = await generateEmbedding(query)
    
    // 构建过滤条件
    let filter = null
    const filterParts = []
    
    if (platform) {
      filterParts.push(`platform = "${platform}"`)
    }
    
    if (detectedCategory) {
      // 类别过滤 - 使用模糊匹配
      const categoryFilter = categoryKeywords[detectedCategory] || [detectedCategory]
      // LanceDB 不支持 OR，所以我们在结果中过滤
    }
    
    if (filterParts.length > 0) {
      filter = filterParts.join(' AND ')
    }
    
    // 执行向量搜索 - 获取更多结果以便过滤
    const searchLimit = detectedCategory ? limit * 5 : limit
    const results = await vectorSearch(TABLES.PRODUCTS_VECTORS, queryVector, searchLimit, filter)
    
    // 解析 metadata、计算相似度、并移除大字段
    let parsedResults = results.map(r => {
      const { name_vector, ...rest } = r // 移除 name_vector 以减少响应大小
      return {
        ...rest,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        similarity: cosineSimilarity(queryVector, name_vector)
      }
    })
    
    // 如果检测到类别，进行过滤
    if (detectedCategory) {
      const categoryKeywordsList = categoryKeywords[detectedCategory] || [detectedCategory]
      parsedResults = parsedResults.filter(r => {
        const cat = (r.category || '').toLowerCase()
        const name = (r.product_name || '').toLowerCase()
        
        // 检查类别字段是否匹配
        const categoryMatch = categoryKeywordsList.some(kw => 
          cat.includes(kw.toLowerCase())
        )
        
        // 如果类别字段匹配，直接返回
        if (categoryMatch) return true
        
        // 如果类别字段为空，检查产品名称
        if (!r.category || cat === '') {
          return categoryKeywordsList.some(kw => 
            name.includes(kw.toLowerCase())
          )
        }
        
        return false
      })
    }
    
    // 按相似度排序
    parsedResults.sort((a, b) => b.similarity - a.similarity)
    
    // 限制结果数量
    parsedResults = parsedResults.slice(0, limit)
    
    res.json({
      success: true,
      data: {
        query,
        detected_category: detectedCategory || null,
        count: parsedResults.length,
        results: parsedResults
      }
    })
  } catch (error) {
    console.error('Semantic search error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/lancedb/products/:id/similar
 * 获取相似产品推荐
 */
router.get('/products/:id/similar', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 5 } = req.query
    
    // 获取当前产品
    const table = await getTable(TABLES.PRODUCTS_VECTORS)
    const products = await table.filter(`id = "${id}"`).toArray()
    
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      })
    }
    
    const product = products[0]
    const productVector = product.name_vector
    
    // 搜索相似产品（排除自身）
    const results = await vectorSearch(TABLES.PRODUCTS_VECTORS, productVector, parseInt(limit) + 1)
    
    // 过滤掉自身并计算相似度
    const similarProducts = results
      .filter(r => r.id !== id)
      .slice(0, parseInt(limit))
      .map(r => ({
        ...r,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        similarity: cosineSimilarity(productVector, r.name_vector)
      }))
    
    res.json({
      success: true,
      data: {
        product: {
          ...product,
          metadata: typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata
        },
        similar: similarProducts
      }
    })
  } catch (error) {
    console.error('Similar products error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/lancedb/products/recommend
 * 智能推荐产品
 * Body: { preferences: { brands?: string[], categories?: string[], priceRange?: [number, number] }, limit?: number }
 */
router.post('/products/recommend', async (req, res) => {
  try {
    const { preferences, limit = 10 } = req.body
    const { brands = [], categories = [], priceRange } = preferences || {}
    
    // 构建推荐查询文本
    const queryText = [...brands, ...categories].join(' ')
    
    if (!queryText) {
      return res.status(400).json({
        success: false,
        error: 'At least one preference (brand or category) is required'
      })
    }
    
    // 生成查询向量
    const queryVector = await generateEmbedding(queryText)
    
    // 执行向量搜索
    let results = await vectorSearch(TABLES.PRODUCTS_VECTORS, queryVector, limit * 2)
    
    // 解析并过滤结果
    results = results
      .map(r => ({
        ...r,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        similarity: cosineSimilarity(queryVector, r.name_vector)
      }))
      .filter(r => {
        // 品牌过滤
        if (brands.length > 0 && !brands.some(b => r.brand?.toLowerCase().includes(b.toLowerCase()))) {
          return false
        }
        // 分类过滤
        if (categories.length > 0 && !categories.some(c => r.category?.toLowerCase().includes(c.toLowerCase()))) {
          return false
        }
        // 价格范围过滤
        if (priceRange && priceRange.length === 2) {
          if (r.price < priceRange[0] || r.price > priceRange[1]) {
            return false
          }
        }
        return true
      })
      .slice(0, limit)
    
    res.json({
      success: true,
      data: {
        preferences,
        count: results.length,
        recommendations: results
      }
    })
  } catch (error) {
    console.error('Recommend error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/lancedb/products
 * 获取所有产品（支持分页和过滤）
 */
router.get('/products', async (req, res) => {
  try {
    const { platform, category, limit = 50, offset = 0 } = req.query
    
    const table = await getTable(TABLES.PRODUCTS_VECTORS)
    
    let query = table.filter('true')
    
    if (platform) {
      query = table.filter(`platform = "${platform}"`)
    }
    
    let results = await query.toArray()
    
    // 解析 metadata
    results = results.map(r => ({
      id: r.id,
      product_name: r.product_name,
      brand: r.brand,
      price: r.price,
      currency: r.currency,
      category: r.category,
      platform: r.platform,
      url: r.url,
      image_url: r.image_url,
      created_at: r.created_at
    }))
    
    // 分类过滤
    if (category) {
      results = results.filter(r => r.category?.toLowerCase().includes(category.toLowerCase()))
    }
    
    const total = results.length
    results = results.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    res.json({
      success: true,
      data: {
        total,
        count: results.length,
        offset: parseInt(offset),
        limit: parseInt(limit),
        products: results
      }
    })
  } catch (error) {
    console.error('Get products error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/lancedb/clean
 * 清理样本数据
 */
router.post('/clean', async (req, res) => {
  try {
    await cleanSampleData()
    res.json({
      success: true,
      message: 'Sample data cleaned'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
