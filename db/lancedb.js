/**
 * LanceDB 数据库连接管理模块
 * 完全替代 sql.js / database.sqlite
 * 支持向量存储和语义搜索
 */

import lancedb from '@lancedb/lancedb'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// LanceDB 数据目录
const LANCEDB_DIR = process.env.LANCEDB_DIR || join(__dirname, '../lancedb')

console.log(`🔍 LanceDB 目录: ${LANCEDB_DIR}`)

// 导出 LANCEDB_DIR
export { LANCEDB_DIR }

// 确保目录存在
const ensureLanceDbDir = () => {
  if (!fs.existsSync(LANCEDB_DIR)) {
    fs.mkdirSync(LANCEDB_DIR, { recursive: true })
    console.log(`✅ 创建 LanceDB 目录: ${LANCEDB_DIR}`)
  }
}

// 表名常量
export const TABLES = {
  // 产品向量表 (已有的)
  PRODUCTS_VECTORS: 'products_vectors',
  GEMSTONE_VECTORS: 'gemstone_vectors',
  GEMSTONE_CATEGORIES: 'gemstone_categories',
  SEARCH_HISTORY: 'search_history',
  
  // 从 SQLite 迁移的表
  NECKLACES: 'necklaces',
  DIAMONDS: 'diamonds',
  INSTAGRAM_POSTS: 'instagram_posts',
  SAKS_PRODUCTS: 'saks_products',
  
  // 平台产品表
  ZOZOTOWN_PRODUCTS: 'zozotown_products',
  RAKUMA_PRODUCTS: 'rakuma_products',
  PAYPAY_PRODUCTS: 'paypay_products',
  YAHOO_PRODUCTS: 'yahoo_products',
  AMAZON_PRODUCTS: 'amazon_products',
  QOO10_PRODUCTS: 'qoo10_products',
  DMM_PRODUCTS: 'dmm_products',
  KAKAKU_PRODUCTS: 'kakaku_products',
  RAKUTEN_PRODUCTS: 'rakuten_products',
  MERCARI_PRODUCTS: 'mercari_products',
  YAHOO_AUCTION_PRODUCTS: 'yahoo_auction_products'
}

let db = null

/**
 * 获取 LanceDB 连接 (单例模式)
 */
export const getDb = async () => {
  if (!db) {
    ensureLanceDbDir()
    db = await lancedb.connect(LANCEDB_DIR)
    console.log('✅ LanceDB 连接已建立')
  }
  return db
}

/**
 * 创建空向量 (384维，用于embedding)
 */
const createEmptyVector = () => new Array(384).fill(0)

/**
 * Schema 定义 - 每个表的样本数据
 */
const SCHEMAS = {
  // ========== 核心业务表 ==========
  
  // necklaces - 配饰排行榜
  [TABLES.NECKLACES]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    website: 'BUYMA',
    productName: 'sample product',
    brand: 'sample brand',
    priceRange: '0',
    sales: 0,
    url: '',
    category: '',
    image: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  // diamonds - 钻石数据
  [TABLES.DIAMONDS]: () => [{
    id: 'sample_0',
    carat: 0,
    color: 'D',
    clarity: 'IF',
    price: 0,
    name_vector: createEmptyVector(),
    search_text: 'sample diamond',
    created_at: new Date().toISOString()
  }],
  
  // instagram_posts - Instagram帖子
  [TABLES.INSTAGRAM_POSTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    hashtag: 'jewelry',
    postId: 'sample',
    username: 'sample',
    caption: 'sample',
    likes: 0,
    comments: 0,
    imageUrl: '',
    url: '',
    name_vector: createEmptyVector(),
    created_at: new Date().toISOString()
  }],
  
  // saks_products - Saks产品
  [TABLES.SAKS_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    currency: 'USD',
    imageUrl: '',
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  // ========== 向量搜索表 ==========
  
  [TABLES.PRODUCTS_VECTORS]: () => [{
    id: 'sample_0',
    table_source: 'sample',
    product_name: 'sample product',
    brand: 'sample brand',
    price: 0,
    currency: 'USD',
    category: 'sample',
    platform: 'sample',
    url: '',
    image_url: '',
    metadata: '{}',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.GEMSTONE_VECTORS]: () => [{
    id: 'sample_0',
    category_id: 'sample',
    category_name_zh: '样本',
    category_name_en: 'sample',
    title: 'sample',
    price: 0,
    rating: 0,
    reviews: 0,
    seller: 'sample',
    asin: '',
    url: '',
    image: '',
    title_vector: createEmptyVector(),
    category_vector: createEmptyVector(),
    metadata: '{}',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.SEARCH_HISTORY]: () => [{
    id: 'sample_0',
    query: 'sample query',
    query_vector: createEmptyVector(),
    results_count: 0,
    timestamp: new Date().toISOString(),
    user_session: 'sample'
  }],
  
  [TABLES.GEMSTONE_CATEGORIES]: () => [{
    id: 'sample_0',
    name_zh: '样本',
    name_en: 'sample',
    keywords: '[]',
    created_at: new Date().toISOString()
  }],
  
  // ========== 平台产品表 (通用Schema) ==========
  
  [TABLES.ZOZOTOWN_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    category: '',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  // 其他平台产品表使用相同Schema
  [TABLES.RAKUMA_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.PAYPAY_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.YAHOO_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.AMAZON_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.QOO10_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.DMM_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.KAKAKU_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.RAKUTEN_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.MERCARI_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }],
  
  [TABLES.YAHOO_AUCTION_PRODUCTS]: () => [{
    id: 'sample_0',
    rank: 0,
    month: '2025-01',
    productName: 'sample',
    brand: 'sample',
    price: 0,
    url: '',
    name_vector: createEmptyVector(),
    search_text: 'sample',
    created_at: new Date().toISOString()
  }]
}

/**
 * 初始化所有表
 */
export const initTables = async () => {
  const db = await getDb()
  const existingTables = await db.tableNames()
  
  for (const [tableName, schemaFn] of Object.entries(SCHEMAS)) {
    if (!existingTables.includes(tableName)) {
      console.log(`📝 创建表 ${tableName}`)
      const sampleData = schemaFn()
      await db.createTable(tableName, sampleData, { mode: 'overwrite' })
    } else {
      console.log(`✅ 表 ${tableName} 已存在`)
    }
  }
  
  console.log('✅ LanceDB 所有表初始化完成')
}

/**
 * 获取表实例
 */
export const getTable = async (tableName) => {
  const db = await getDb()
  try {
    return await db.openTable(tableName)
  } catch (e) {
    // 表不存在，创建它
    if (SCHEMAS[tableName]) {
      const sampleData = SCHEMAS[tableName]()
      await db.createTable(tableName, sampleData, { mode: 'overwrite' })
      return await db.openTable(tableName)
    }
    throw e
  }
}

/**
 * 向量搜索
 * @param {string} tableName - 表名
 * @param {number[]} queryVector - 查询向量
 * @param {number} limit - 返回数量
 * @param {string} filter - 过滤条件
 */
export const vectorSearch = async (tableName, queryVector, limit = 10, filter = null) => {
  const table = await getTable(tableName)
  let query = table.search(queryVector).limit(limit)
  
  if (filter) {
    query = query.where(filter)
  }
  
  const results = await query.toArray()
  
  // Convert BigInt to Number for JSON serialization
  return results.map(row => {
    const converted = {}
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === 'bigint' ? Number(value) : value
    }
    return converted
  })
}

/**
 * 插入数据
 * @param {string} tableName - 表名
 * @param {object[]} data - 数据数组
 */
export const insertData = async (tableName, data) => {
  const db = await getDb()
  
  // 支持单条记录或数组
  const dataArray = Array.isArray(data) ? data : [data]
  
  try {
    const table = await db.openTable(tableName)
    await table.add(dataArray)
    console.log(`✅ 插入 ${dataArray.length} 条数据到 ${tableName}`)
  } catch (e) {
    // 表不存在或出错，检查是否需要创建
    if (e.message && e.message.includes('does not exist')) {
      await db.createTable(tableName, dataArray)
      console.log(`✅ 创建表 ${tableName} 并插入 ${dataArray.length} 条数据`)
    } else if (SCHEMAS[tableName]) {
      // 使用 schema 创建表
      const sampleData = SCHEMAS[tableName]()
      await db.createTable(tableName, [...sampleData, ...dataArray], { mode: 'overwrite' })
      // 然后删除样本数据
      const table = await db.openTable(tableName)
      await table.delete('id LIKE "sample_"')
      console.log(`✅ 重建表 ${tableName} 并插入 ${dataArray.length} 条数据`)
    } else {
      throw e
    }
  }
}

/**
 * 删除数据
 * @param {string} tableName - 表名
 * @param {string} filter - 删除条件
 */
export const deleteData = async (tableName, filter) => {
  const table = await getTable(tableName)
  await table.delete(filter)
  console.log(`🗑️ 从 ${tableName} 删除数据: ${filter}`)
}

/**
 * 更新数据 (LanceDB 不支持直接更新，需要删除后重新插入)
 * @param {string} tableName - 表名
 * @param {string} filter - 删除条件
 * @param {object[]} newData - 新数据
 */
export const updateData = async (tableName, filter, newData) => {
  await deleteData(tableName, filter)
  await insertData(tableName, newData)
}

/**
 * 查询数据
 * @param {string} tableName - 表名
 * @param {string} filter - 过滤条件 (可选)
 * @param {number} limit - 返回数量
 */
export const queryData = async (tableName, filter = null, limit = null) => {
  const table = await getTable(tableName)
  let query = table.query()
  
  if (filter) {
    query = query.where(filter)
  }
  
  if (limit) {
    query = query.limit(limit)
  }
  
  const results = await query.toArray()
  
  // Convert BigInt to Number for JSON serialization
  return results.map(row => {
    const converted = {}
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === 'bigint' ? Number(value) : value
    }
    return converted
  })
}

/**
 * 获取表的行数
 * @param {string} tableName - 表名
 */
export const countRows = async (tableName) => {
  try {
    const table = await getTable(tableName)
    return await table.countRows()
  } catch (e) {
    return 0
  }
}

/**
 * 获取所有表的统计信息
 */
export const getStats = async () => {
  const db = await getDb()
  const tables = await db.tableNames()
  
  const stats = {}
  for (const tableName of tables) {
    stats[tableName] = await countRows(tableName)
  }
  
  return stats
}

/**
 * 清空样本数据
 */
export const cleanSampleData = async () => {
  const db = await getDb()
  const tables = await db.tableNames()
  
  for (const tableName of tables) {
    try {
      const table = await db.openTable(tableName)
      await table.delete('id LIKE "sample_%"')
    } catch (e) {
      // 忽略错误
    }
  }
  
  console.log('🧹 清理样本数据完成')
}

/**
 * 获取不重复的月份列表
 * @param {string} tableName - 表名
 */
export const getDistinctMonths = async (tableName) => {
  const data = await queryData(tableName)
  const months = [...new Set(data.filter(d => d.month && !d.id.startsWith('sample_')).map(d => d.month))]
  return months.sort((a, b) => b.localeCompare(a))
}

/**
 * 获取不重复的品牌列表
 * @param {string} tableName - 表名
 */
export const getDistinctBrands = async (tableName) => {
  const data = await queryData(tableName)
  const brands = [...new Set(data.filter(d => d.brand && !d.id.startsWith('sample_')).map(d => d.brand))]
  return brands.sort()
}

/**
 * 获取不重复的网站列表
 * @param {string} tableName - 表名
 */
export const getDistinctWebsites = async (tableName) => {
  const data = await queryData(tableName)
  const websites = [...new Set(data.filter(d => d.website && !d.id.startsWith('sample_')).map(d => d.website))]
  return websites.sort()
}

/**
 * 获取不重复的类别列表
 * @param {string} tableName - 表名
 * @param {string} month - 月份
 */
export const getDistinctCategories = async (tableName, month) => {
  const data = await queryData(tableName, `month = '${month}'`)
  const categories = [...new Set(data.filter(d => d.category && d.category !== '' && !d.id.startsWith('sample_')).map(d => d.category))]
  return categories.sort()
}

/**
 * 获取不重复的标签列表
 * @param {string} tableName - 表名
 */
export const getDistinctHashtags = async (tableName) => {
  const data = await queryData(tableName)
  const hashtags = [...new Set(data.filter(d => d.hashtag && !d.id.startsWith('sample_')).map(d => d.hashtag))]
  return hashtags.sort()
}

export default {
  getDb,
  initTables,
  getTable,
  vectorSearch,
  insertData,
  deleteData,
  updateData,
  queryData,
  countRows,
  getStats,
  cleanSampleData,
  getDistinctMonths,
  getDistinctBrands,
  getDistinctWebsites,
  getDistinctCategories,
  getDistinctHashtags,
  TABLES,
  SCHEMAS
}
