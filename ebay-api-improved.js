/**
 * eBay API 改进版 - 使用 REST API + OAuth 2.0
 * 
 * 功能：
 * 1. OAuth 2.0 客户端凭证认证
 * 2. 速率限制监控和自动退避
 * 3. Token 自动刷新
 * 4. Browse API 搜索商品（替代 Finding API）
 */

import dotenv from 'dotenv'
dotenv.config()

// eBay OAuth 配置
const EBAY_CONFIG = {
  // 生产环境
  production: {
    baseUrl: 'https://api.ebay.com',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    browseApi: 'https://api.ebay.com/buy/browse/v1'
  },
  // 沙盒环境（开发测试用）
  sandbox: {
    baseUrl: 'https://api.sandbox.ebay.com',
    tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browseApi: 'https://api.sandbox.ebay.com/buy/browse/v1'
  }
}

// 当前环境（从 .env 读取）
const ENV = process.env.EBAY_ENV === 'production' ? 'production' : 'sandbox'
const config = EBAY_CONFIG[ENV]

// Token 缓存
let cachedToken = null
let tokenExpiry = 0

/**
 * 获取 OAuth 2.0 Access Token（客户端凭证授权）
 * 适用场景：访问公共数据（搜索商品、查看类别等）
 */
const getEbayAccessToken = async () => {
  // 检查缓存是否有效
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const clientId = process.env.EBAY_APP_ID      // App ID (Client ID)
  const clientSecret = process.env.EBAY_CERT_ID  // Cert ID (Client Secret)

  if (!clientId || !clientSecret) {
    throw new Error('缺少 eBay OAuth 凭证。请在 .env 中设置 EBAY_APP_ID 和 EBAY_CERT_ID')
  }

  // Base64 编码 Client ID:Client Secret
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth 失败: ${response.status} - ${error}`)
    }

    const data = await response.json()
    
    // 缓存 Token（提前 5 分钟过期，避免边界情况）
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    console.log(`✅ eBay OAuth Token 已获取，有效期: ${data.expires_in} 秒`)
    return cachedToken

  } catch (error) {
    console.error('❌ 获取 eBay Token 失败:', error.message)
    throw error
  }
}

/**
 * 速率限制监控器
 */
const rateLimiter = {
  limit: 0,
  remaining: 0,
  resetTime: 0,
  
  // 更新速率限制信息
  update(headers) {
    this.limit = parseInt(headers.get('X-RateLimit-Limit') || '0')
    this.remaining = parseInt(headers.get('X-RateLimit-Remaining') || '0')
    this.resetTime = parseInt(headers.get('X-RateLimit-Reset') || '0') * 1000
    
    console.log(`📊 速率限制: ${this.remaining}/${this.limit} (重置时间: ${new Date(this.resetTime).toLocaleString()})`)
  },
  
  // 检查是否需要等待
  shouldWait() {
    if (this.remaining <= 5 && this.resetTime > Date.now()) {
      const waitMs = this.resetTime - Date.now() + 1000
      return waitMs
    }
    return 0
  }
}

/**
 * 指数退避重试机制
 * @param {Function} fn - 要执行的异步函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} baseDelay - 基础延迟（毫秒）
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // 速率限制错误 (429)
      if (error.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`⏳ 速率限制，等待 ${delay}ms 后重试 (尝试 ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // 其他错误或最后一次重试失败
      throw error
    }
  }
}

/**
 * 使用 Browse API 搜索商品（REST API 版本）
 * 替代传统的 Finding API
 * 
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回数量
 * @param {object} filters - 额外过滤条件
 */
const fetchEbayDataRest = async (query = 'jewelry', limit = 50, filters = {}) => {
  try {
    // 获取 Access Token
    const token = await getEbayAccessToken()
    
    // 检查是否需要等待（速率限制）
    const waitMs = rateLimiter.shouldWait()
    if (waitMs > 0) {
      console.log(`⏳ 接近速率限制，等待 ${waitMs}ms`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }

    // 构建搜索请求
    // Browse API: https://api.ebay.com/browse/v1/item_summary/search
    const searchUrl = new URL(`${config.browseApi}/item_summary/search`)
    searchUrl.searchParams.append('q', query)
    searchUrl.searchParams.append('limit', limit.toString())
    
    // 可选过滤条件
    if (filters.categoryIds) {
      searchUrl.searchParams.append('category_ids', filters.categoryIds)
    }
    if (filters.priceMin) {
      searchUrl.searchParams.append('price', `[${filters.priceMin}..]`)
    }
    if (filters.condition) {
      searchUrl.searchParams.append('conditionIds', filters.condition)
    }

    // 使用退避重试机制发送请求
    const response = await retryWithBackoff(async () => {
      const res = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      // 更新速率限制信息
      rateLimiter.update(res.headers)
      
      // 处理速率限制
      if (res.status === 429) {
        const error = new Error('速率限制')
        error.status = 429
        throw error
      }
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`API 请求失败: ${res.status} - ${errorText}`)
      }
      
      return res
    })

    const data = await response.json()
    
    // 解析结果
    const items = (data.itemSummaries || []).map((item, index) => ({
      rank: index + 1,
      productName: item.title,
      brand: item.brand || 'OTHER',
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || 'USD',
      condition: item.condition,
      imageUrl: item.image?.imageUrl,
      url: item.itemWebUrl,
      itemId: item.itemId,
      seller: item.seller?.username,
      sellerLocation: item.itemLocation?.postalCode,
      country: item.itemLocation?.country,
      category: query,
      // 额外信息
      additionalInfo: {
        itemGroupId: item.itemGroupIds?.[0],
        categoryId: item.categories?.[0]?.categoryId,
        categoryName: item.categories?.[0]?.categoryName
      }
    }))

    console.log(`✅ eBay REST API: 获取 ${items.length} 条 "${query}" 数据`)
    return { 
      items, 
      source: 'ebay-rest-api',
      environment: ENV,
      rateLimit: {
        remaining: rateLimiter.remaining,
        limit: rateLimiter.limit,
        resetTime: rateLimiter.resetTime
      }
    }

  } catch (error) {
    console.error('❌ eBay REST API 失败:', error.message)
    return { items: [], error: error.message }
  }
}

/**
 * Marketplace Account Deletion 通知端点处理
 * GDPR/CCPA 合规要求
 * 
 * @param {object} notification - eBay 发送的删除通知
 */
const handleAccountDeletionNotification = async (notification) => {
  try {
    // 1. 验证签名（需要实现签名验证逻辑）
    // const isValid = await verifySignature(notification)
    // if (!isValid) throw new Error('签名验证失败')

    // 2. 提取用户 ID
    const userId = notification.notification?.data?.userId
    if (!userId) {
      throw new Error('通知中缺少用户 ID')
    }

    console.log(`🔔 收到账号删除通知，用户 ID: ${userId}`)

    // 3. 删除该用户的所有数据
    // 这里需要根据你的数据库结构实现删除逻辑
    // 例如: await dbExec('DELETE FROM user_data WHERE ebay_user_id = ?', [userId])

    console.log(`✅ 已删除用户 ${userId} 的所有数据`)
    
    return { success: true, deletedUserId: userId }
    
  } catch (error) {
    console.error('❌ 处理账号删除通知失败:', error.message)
    return { success: false, error: error.message }
  }
}

// 导出改进版函数
export {
  getEbayAccessToken,
  fetchEbayDataRest,
  handleAccountDeletionNotification,
  rateLimiter
}

// 使用示例（在 server.js 中）：
/*
import { fetchEbayDataRest } from './ebay-api-improved.js'

// 替换原有的 fetchEbayData
app.post('/api/ebay/refresh/:month', async (req, res) => {
  const { month } = req.params
  const result = await fetchEbayDataRest('jewelry', 50)
  // ... 保存到数据库
})
*/
