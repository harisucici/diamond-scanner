/**
 * Turso 数据库连接管理模块
 * 替代 LanceDB，使用 Turso (libSQL) 实现数据持久化
 */

import { createClient } from '@libsql/client'

// 表名常量
export const TABLES = {
  // 产品向量表
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
  YAHOO_AUCTION_PRODUCTS: 'yahoo_auction_products',
  FASHIONPHILE_PRODUCTS: 'fashionphile_products',
  EBAY_PRODUCTS: 'ebay_products',
  GRAILED_PRODUCTS: 'grailed_products',
  POSHMARK_PRODUCTS: 'poshmark_products',
  MERCARI_US_PRODUCTS: 'mercarius_products',
  KOMEHYO_PRODUCTS: 'komehyo_products',
  REBAG_PRODUCTS: 'rebag_products',
  VESTIAIRE_PRODUCTS: 'vestiaire_products',
  CHRONO24_PRODUCTS: 'chrono24_products',

  ALLU_PRODUCTS: 'allu_products',
  MEJURI_PRODUCTS: 'mejuri_products',
  SOCIAL_TIKTOK: 'social_tiktok',
  SOCIAL_INSTAGRAM: 'social_instagram',
  SOCIAL_SUMMARY: 'social_summary',

  // CAD 学习表
  CAD_LEARNING: 'cad_learning'
}

// 单例客户端
let client = null

/**
 * 获取 Turso 客户端 (单例模式)
 */
export const getClient = () => {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    
    if (!url || !authToken) {
      throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment variables')
    }
    
    client = createClient({
      url,
      authToken
    })
    console.log('✅ Turso 客户端已创建')
  }
  return client
}

/**
 * 获取数据库实例（兼容 LanceDB 接口）
 * 返回对象支持 db.tableNames() 等方法
 */
export const getDb = async () => {
  const client = getClient()
  
  // 包装客户端以支持 LanceDB 兼容接口
  return {
    ...client,
    // LanceDB db.tableNames() 兼容
    tableNames: async () => {
      const result = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        args: []
      })
      return result.rows.map(row => row.name)
    },
    // LanceDB db.createTable() 兼容
    createTable: async (tableName, data, options = {}) => {
      // 在 Turso 中，表由 initTables() 创建
      // 如果需要创建新表，使用 INSERT
      if (data && data.length > 0) {
        const table = await getTable(tableName)
        await table.add(data)
      }
    },
    // LanceDB db.openTable() 兼容
    openTable: async (tableName) => {
      return await getTable(tableName)
    },
    // 原始客户端方法
    execute: client.execute.bind(client),
    close: client.close.bind(client)
  }
}

/**
 * 表结构定义
 */
const TABLE_SCHEMAS = {
  [TABLES.NECKLACES]: `
    CREATE TABLE IF NOT EXISTS necklaces (
      id TEXT PRIMARY KEY,
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
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.DIAMONDS]: `
    CREATE TABLE IF NOT EXISTS diamonds (
      id TEXT PRIMARY KEY,
      carat REAL,
      color TEXT,
      clarity TEXT,
      price REAL,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.INSTAGRAM_POSTS]: `
    CREATE TABLE IF NOT EXISTS instagram_posts (
      id TEXT PRIMARY KEY,
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
      name_vector TEXT,
      created_at TEXT
    )
  `,
  [TABLES.SAKS_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS saks_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.PRODUCTS_VECTORS]: `
    CREATE TABLE IF NOT EXISTS products_vectors (
      id TEXT PRIMARY KEY,
      table_source TEXT,
      product_name TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      category TEXT,
      platform TEXT,
      url TEXT,
      image_url TEXT,
      metadata TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.GEMSTONE_VECTORS]: `
    CREATE TABLE IF NOT EXISTS gemstone_vectors (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      category_name_zh TEXT,
      category_name_en TEXT,
      title TEXT,
      price REAL,
      rating REAL,
      reviews INTEGER,
      seller TEXT,
      asin TEXT,
      url TEXT,
      image TEXT,
      title_vector TEXT,
      category_vector TEXT,
      metadata TEXT,
      created_at TEXT
    )
  `,
  [TABLES.SEARCH_HISTORY]: `
    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      query TEXT,
      query_vector TEXT,
      results_count INTEGER,
      timestamp TEXT,
      user_session TEXT
    )
  `,
  [TABLES.GEMSTONE_CATEGORIES]: `
    CREATE TABLE IF NOT EXISTS gemstone_categories (
      id TEXT PRIMARY KEY,
      name_zh TEXT,
      name_en TEXT,
      keywords TEXT,
      created_at TEXT
    )
  `,
  [TABLES.ZOZOTOWN_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS zozotown_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      category TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.RAKUMA_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS rakuma_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.PAYPAY_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS paypay_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.YAHOO_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS yahoo_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.AMAZON_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS amazon_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.QOO10_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS qoo10_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.DMM_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS dmm_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.KAKAKU_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS kakaku_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.RAKUTEN_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS rakuten_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.MERCARI_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS mercari_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.YAHOO_AUCTION_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS yahoo_auction_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.FASHIONPHILE_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS fashionphile_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      productType TEXT,
      collection TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.EBAY_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS ebay_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      itemId TEXT,
      seller TEXT,
      sellerLocation TEXT,
      country TEXT,
      category TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.GRAILED_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS grailed_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      designer TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.POSHMARK_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS poshmark_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.MERCARI_US_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS mercarius_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.CAD_LEARNING]: `
    CREATE TABLE IF NOT EXISTS cad_learning (
      id TEXT PRIMARY KEY,
      image_hash TEXT,
      original_analysis TEXT,
      user_correction TEXT,
      risk_item TEXT,
      embedding TEXT,
      timestamp TEXT
    )
  `,
  [TABLES.KOMEHYO_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS komehyo_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.REBAG_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS rebag_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.VESTIAIRE_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS vestiaire_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `,
  [TABLES.CHRONO24_PRODUCTS]: `
    CREATE TABLE IF NOT EXISTS chrono24_products (
      id TEXT PRIMARY KEY,
      rank INTEGER,
      month TEXT,
      productName TEXT,
      brand TEXT,
      price REAL,
      currency TEXT,
      condition TEXT,
      imageUrl TEXT,
      url TEXT,
      name_vector TEXT,
      search_text TEXT,
      created_at TEXT
    )
  `
}

// Keep the social routes from the upstream update compatible with Turso.
for (const table of [TABLES.SOCIAL_TIKTOK, TABLES.SOCIAL_INSTAGRAM]) {
  TABLE_SCHEMAS[table] = `CREATE TABLE IF NOT EXISTS ${table} (
    id TEXT PRIMARY KEY, author TEXT, url TEXT, platform TEXT, addedAt TEXT
  )`
}
TABLE_SCHEMAS[TABLES.SOCIAL_SUMMARY] = `CREATE TABLE IF NOT EXISTS social_summary (
  id TEXT PRIMARY KEY, content TEXT, updated_at TEXT
)`

// Public catalogs share the same snapshot fields; existing platform tables remain intact.
for (const table of [TABLES.ALLU_PRODUCTS, TABLES.MEJURI_PRODUCTS]) {
  TABLE_SCHEMAS[table] = `CREATE TABLE IF NOT EXISTS ${table} (
    id TEXT PRIMARY KEY, rank INTEGER, month TEXT, productName TEXT, brand TEXT,
    price REAL, currency TEXT, condition TEXT, imageUrl TEXT, url TEXT, created_at TEXT
  )`
}

/**
 * 初始化所有表（幂等操作）
 */
export const initTables = async () => {
  const db = getClient()
  
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    try {
      await db.execute(schema)
      console.log(`✅ 表 ${tableName} 已创建或已存在`)
    } catch (error) {
      console.error(`❌ 创建表 ${tableName} 失败:`, error.message)
      throw error
    }
  }
  
  console.log('✅ Turso 所有表初始化完成')
}

/**
 * 获取表实例（兼容 LanceDB 接口）
 * 返回对象支持 table.query().limit(N).toArray() 链式调用
 */
export const getTable = async (tableName) => {
  const db = getClient()
  
  const table = {
    query: () => {
      let _filter = null
      let _limit = null
      
      const queryBuilder = {
        where: (filter) => {
          _filter = filter
          return queryBuilder
        },
        limit: (n) => {
          _limit = n
          return queryBuilder
        },
        toArray: async () => {
          let sql = `SELECT * FROM ${tableName}`
          const args = []
          if (_filter) {
            sql += ` WHERE ${_filter}`
          }
          if (_limit) {
            sql += ` LIMIT ?`
            args.push(_limit)
          }
          const result = await db.execute({ sql, args })
          return result.rows.map(row => {
            const converted = {}
            for (const [key, value] of Object.entries(row)) {
              converted[key] = typeof value === 'bigint' ? Number(value) : value
            }
            return parseJsonFields(converted)
          })
        }
      }
      return queryBuilder
    },
    // LanceDB table.delete(filterStr) 兼容
    delete: async (filterStr) => {
      await db.execute({ sql: `DELETE FROM ${tableName} WHERE ${filterStr}`, args: [] })
    },
    // LanceDB table.add(dataArray) 兼容
    add: async (dataArray) => {
      for (const item of dataArray) {
        const serialized = serializeJsonFields(item)
        const columns = Object.keys(serialized)
        const placeholders = columns.map(() => '?').join(', ')
        const values = columns.map(col => serialized[col])
        await db.execute({
          sql: `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          args: values
        })
      }
    },
    countRows: async () => {
      const result = await db.execute({
        sql: `SELECT COUNT(*) as count FROM ${tableName}`,
        args: []
      })
      return Number(result.rows[0].count)
    },
    name: tableName
  }
  
  return table
}

/**
 * 解析 JSON 字段（向量存储为 JSON 字符串）
 */
const parseJsonFields = (row) => {
  const jsonFields = ['name_vector', 'title_vector', 'category_vector', 'query_vector', 'embedding', 'metadata', 'keywords']
  const parsed = { ...row }
  
  for (const field of jsonFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field])
      } catch (e) {
        // 保持原值
      }
    }
  }
  
  return parsed
}

/**
 * 序列化 JSON 字段
 */
const serializeJsonFields = (data) => {
  const jsonFields = ['name_vector', 'title_vector', 'category_vector', 'query_vector', 'embedding', 'metadata', 'keywords']
  const serialized = { ...data }
  
  for (const field of jsonFields) {
    if (serialized[field] !== undefined && typeof serialized[field] === 'object') {
      serialized[field] = JSON.stringify(serialized[field])
    }
  }
  
  return serialized
}

/**
 * 查询数据
 * @param {string} tableName - 表名
 * @param {string} filter - 过滤条件 (可选，SQL WHERE 子句)
 * @param {number} limit - 返回数量 (可选)
 */
export const queryData = async (tableName, filter = null, limit = null) => {
  const db = getClient()
  
  let sql = `SELECT * FROM ${tableName}`
  const args = []
  
  if (filter) {
    sql += ` WHERE ${filter}`
  }
  
  if (limit) {
    sql += ` LIMIT ?`
    args.push(limit)
  }
  
  const result = await db.execute({ sql, args })
  
  return result.rows.map(row => {
    // 转换 BigInt 为 Number
    const converted = {}
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === 'bigint' ? Number(value) : value
    }
    return parseJsonFields(converted)
  })
}

/**
 * 插入数据
 * @param {string} tableName - 表名
 * @param {object|object[]} data - 单条记录或数组
 */
export const insertData = async (tableName, data) => {
  const db = getClient()
  
  const dataArray = Array.isArray(data) ? data : [data]
  
  for (const item of dataArray) {
    const serialized = serializeJsonFields(item)
    const columns = Object.keys(serialized)
    const placeholders = columns.map(() => '?').join(', ')
    const values = columns.map(col => serialized[col])
    
    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    
    await db.execute({ sql, args: values })
  }
  
  console.log(`✅ 插入 ${dataArray.length} 条数据到 ${tableName}`)
}

/**
 * 删除数据
 * @param {string} tableName - 表名
 * @param {string|object} filter - 删除条件 (SQL WHERE 子句或对象)
 */
export const deleteData = async (tableName, filter) => {
  const db = getClient()
  if (filter == null) {
    const socialTables = [TABLES.SOCIAL_TIKTOK, TABLES.SOCIAL_INSTAGRAM, TABLES.SOCIAL_SUMMARY]
    if (!socialTables.includes(tableName)) throw new Error('删除商品数据需要指定条件')
    await db.execute(`DELETE FROM ${tableName}`)
    return
  }
  
  let filterStr = filter
  const args = []
  
  // 如果 filter 是对象，转换为 SQL 字符串
  if (typeof filter === 'object' && filter !== null) {
    const conditions = Object.entries(filter).map(([key, value]) => {
      if (typeof value === 'string') {
        args.push(value)
        return `${key} = ?`
      } else {
        args.push(value)
        return `${key} = ?`
      }
    })
    filterStr = conditions.join(' AND ')
  }
  
  const sql = `DELETE FROM ${tableName} WHERE ${filterStr}`
  await db.execute({ sql, args })
  
  console.log(`🗑️ 从 ${tableName} 删除数据: ${filterStr}`)
}

/**
 * 向量搜索（使用 JavaScript 计算余弦相似度）
 * @param {string} tableName - 表名
 * @param {number[]} queryVector - 查询向量
 * @param {number} limit - 返回数量
 * @param {string} filter - 过滤条件 (可选)
 */
export const vectorSearch = async (tableName, queryVector, limit = 10, filter = null) => {
  // 先查询所有数据（带过滤）
  const results = await queryData(tableName, filter)
  
  // 确定向量字段名
  const vectorField = tableName === TABLES.CAD_LEARNING ? 'embedding' : 'name_vector'
  
  // 计算余弦相似度
  const scoredResults = results.map(row => {
    const vector = row[vectorField]
    if (!vector || !Array.isArray(vector)) {
      return { ...row, similarity: 0 }
    }
    
    const similarity = cosineSimilarity(queryVector, vector)
    return { ...row, similarity }
  })
  
  // 按相似度排序并限制数量
  scoredResults.sort((a, b) => b.similarity - a.similarity)
  return scoredResults.slice(0, limit)
}

/**
 * 计算余弦相似度
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * 获取表的行数
 * @param {string} tableName - 表名
 */
export const countRows = async (tableName) => {
  try {
    const db = getClient()
    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM ${tableName}`,
      args: []
    })
    return Number(result.rows[0].count)
  } catch (e) {
    return 0
  }
}

/**
 * 获取所有表的统计信息
 */
export const getStats = async () => {
  const db = getClient()
  
  // 获取所有表名
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    args: []
  })
  
  const tables = result.rows.map(row => row.name)
  
  const stats = {}
  for (const tableName of tables) {
    stats[tableName] = await countRows(tableName)
  }
  
  return stats
}

/**
 * 获取不重复的月份列表
 */
export const getDistinctMonths = async (tableName) => {
  const data = await queryData(tableName)
  const months = [...new Set(data.filter(d => d.month && !d.id.startsWith('sample_')).map(d => d.month))]
  return months.sort((a, b) => b.localeCompare(a))
}

/**
 * 获取不重复的品牌列表
 */
export const getDistinctBrands = async (tableName) => {
  const data = await queryData(tableName)
  const brands = [...new Set(data.filter(d => d.brand && !d.id.startsWith('sample_')).map(d => d.brand))]
  return brands.sort()
}

/**
 * 获取不重复的网站列表
 */
export const getDistinctWebsites = async (tableName) => {
  const data = await queryData(tableName)
  const websites = [...new Set(data.filter(d => d.website && !d.id.startsWith('sample_')).map(d => d.website))]
  return websites.sort()
}

/**
 * 获取不重复的类别列表
 */
export const getDistinctCategories = async (tableName, month) => {
  const data = await queryData(tableName, `month = '${month}'`)
  const categories = [...new Set(data.filter(d => d.category && d.category !== '' && !d.id.startsWith('sample_')).map(d => d.category))]
  return categories.sort()
}

/**
 * 获取不重复的标签列表
 */
export const getDistinctHashtags = async (tableName) => {
  const data = await queryData(tableName)
  const hashtags = [...new Set(data.filter(d => d.hashtag && !d.id.startsWith('sample_')).map(d => d.hashtag))]
  return hashtags.sort()
}

// 导出 LANCEDB_DIR 为 null（兼容性）
export const LANCEDB_DIR = null

export default {
  getClient,
  getDb,
  initTables,
  getTable,
  vectorSearch,
  insertData,
  deleteData,
  queryData,
  countRows,
  getStats,
  getDistinctMonths,
  getDistinctBrands,
  getDistinctWebsites,
  getDistinctCategories,
  getDistinctHashtags,
  TABLES
}
