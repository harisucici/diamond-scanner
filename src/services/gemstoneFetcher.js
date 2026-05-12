/**
 * 宝石销量数据获取工作流
 * Gemstone Sales Data Fetcher Workflow
 * 
 * 支持品类：
 * - 培育钻石 (Lab-Grown Diamond)
 * - 培育祖母绿 (Lab-Grown Emerald)
 * - 培育红宝石 (Lab-Grown Ruby)
 * - 培育蓝宝石 (Lab-Grown Sapphire)
 * - 海水珍珠 (Saltwater Pearl)
 * - 淡水珍珠 (Freshwater Pearl)
 * 
 * 数据源：
 * - Amazon (via Rainforest API)
 * - 日本电商网站 (ZOZOTOWN, Rakuma, PayPay, etc.)
 * - 其他国际平台 (Etsy, Fashionphile, Saks)
 */

import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载品类配置
const loadCategoryConfig = () => {
  try {
    const configPath = join(__dirname, '../config/gemstone_categories.yaml')
    const content = fs.readFileSync(configPath, 'utf-8')
    return yaml.load(content)
  } catch (error) {
    console.error('加载品类配置失败:', error.message)
    return null
  }
}

const CATEGORY_CONFIG = loadCategoryConfig()

// Rainforest API 配置
const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY || ''
const RAINFOREST_BASE_URL = 'https://api.rainforestapi.com/request'

// 通用请求头
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ja;q=0.7'
}

/**
 * 国家识别
 */
const identifyCountry = (location) => {
  if (!location || !CATEGORY_CONFIG) return 'Unknown'
  
  const locationStr = String(location)
  const countryMap = CATEGORY_CONFIG.country_mapping || {}
  
  // 直接匹配
  if (countryMap[locationStr]) {
    return countryMap[locationStr]
  }
  
  // 包含匹配
  for (const [key, value] of Object.entries(countryMap)) {
    if (locationStr.includes(key)) {
      return value
    }
  }
  
  return locationStr
}

/**
 * 使用 Rainforest API 搜索 Amazon 产品
 * @param {string} keyword - 搜索关键词
 * @param {string} domain - Amazon 域名 (amazon.com, amazon.co.jp)
 * @param {number} pages - 页数
 * @returns {Array} 产品列表
 */
export const fetchAmazonData = async (keyword, domain = 'amazon.com', pages = 1) => {
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
        let country = domain.includes('.jp') ? 'Japan' : 'United States'
        
        // 尝试从卖家信息获取国家
        if (item.seller?.location) {
          country = identifyCountry(item.seller.location)
        }
        
        items.push({
          platform: domain.includes('.jp') ? 'Amazon Japan' : 'Amazon',
          title: item.title || '',
          price: item.price?.value || 0,
          currency: item.price?.currency || 'USD',
          rating: item.rating || 0,
          reviews: item.ratings_total || 0,
          seller: item.seller?.name || 'Unknown',
          country: country,
          location: item.seller?.location || '',
          asin: item.asin || '',
          url: item.link || `https://www.${domain}/dp/${item.asin}`,
          image: item.image || '',
          is_prime: item.is_prime || false,
          is_best_seller: item.is_best_seller || false,
          timestamp: new Date().toISOString(),
          keyword: keyword
        })
      }
      
      console.log(`   ✅ 获取 ${searchResults.length} 个产品`)
      
      // 避免请求过快
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  } catch (error) {
    console.error('❌ Amazon 数据获取失败:', error.message)
  }
  
  return items
}

/**
 * 批量获取指定品类的数据
 * @param {string} categoryId - 品类ID (lab_diamond, lab_emerald, etc.)
 * @param {Object} options - 选项
 * @returns {Object} 聚合数据
 */
export const fetchCategoryData = async (categoryId, options = {}) => {
  const {
    useEnglishKeywords = true,
    useChineseKeywords = true,
    amazonDomains = ['amazon.com'], // 可添加 'amazon.co.jp'
    pagesPerKeyword = 1
  } = options
  
  if (!CATEGORY_CONFIG || !CATEGORY_CONFIG.categories[categoryId]) {
    console.error(`❌ 未知的品类ID: ${categoryId}`)
    return null
  }
  
  const category = CATEGORY_CONFIG.categories[categoryId]
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${category.icon} ${category.name_zh} / ${category.name_en}`)
  console.log(`${'='.repeat(60)}`)
  
  const allProducts = []
  const keywords = []
  
  // 收集关键词
  if (useEnglishKeywords && category.keywords.english) {
    keywords.push(...category.keywords.english.map(k => ({ keyword: k, lang: 'en' })))
  }
  if (useChineseKeywords && category.keywords.chinese) {
    keywords.push(...category.keywords.chinese.map(k => ({ keyword: k, lang: 'zh' })))
  }
  
  // 从 Amazon 获取数据
  for (const domain of amazonDomains) {
    for (const { keyword, lang } of keywords) {
      // 中文关键词只在 .com 域名搜索（支持中文）
      if (lang === 'zh' && !domain.includes('.com')) continue
      
      const products = await fetchAmazonData(keyword, domain, pagesPerKeyword)
      allProducts.push(...products)
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  // 数据分析
  const analysis = analyzeProducts(allProducts, categoryId)
  
  return {
    category: categoryId,
    category_name_zh: category.name_zh,
    category_name_en: category.name_en,
    timestamp: new Date().toISOString(),
    total_products: allProducts.length,
    products: allProducts,
    analysis: analysis
  }
}

/**
 * 分析产品数据
 */
const analyzeProducts = (products, categoryId) => {
  if (products.length === 0) {
    return null
  }
  
  // 去重（基于 ASIN）
  const uniqueProducts = []
  const seenAsins = new Set()
  
  for (const product of products) {
    if (product.asin && !seenAsins.has(product.asin)) {
      seenAsins.add(product.asin)
      uniqueProducts.push(product)
    }
  }
  
  // 价格统计
  const prices = uniqueProducts.filter(p => p.price > 0).map(p => p.price)
  const totalValue = prices.reduce((sum, p) => sum + p, 0)
  const avgPrice = prices.length > 0 ? totalValue / prices.length : 0
  
  // 价格区间分布
  const priceDistribution = {
    under_100: prices.filter(p => p < 100).length,
    range_100_500: prices.filter(p => p >= 100 && p < 500).length,
    range_500_1000: prices.filter(p => p >= 500 && p < 1000).length,
    over_1000: prices.filter(p => p >= 1000).length
  }
  
  // 评分统计
  const ratings = uniqueProducts.filter(p => p.rating > 0).map(p => p.rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0
  
  const ratingDistribution = {
    '4.5_plus': ratings.filter(r => r >= 4.5).length,
    '4.0_4.5': ratings.filter(r => r >= 4.0 && r < 4.5).length,
    'under_4.0': ratings.filter(r => r < 4.0).length,
    no_rating: uniqueProducts.filter(p => p.rating === 0).length
  }
  
  // 国家分布
  const countryStats = {}
  for (const product of uniqueProducts) {
    const country = product.country || 'Unknown'
    if (!countryStats[country]) {
      countryStats[country] = {
        count: 0,
        total_value: 0,
        avg_price: 0,
        products: []
      }
    }
    countryStats[country].count++
    countryStats[country].total_value += product.price
    if (countryStats[country].products.length < 10) {
      countryStats[country].products.push({
        title: product.title,
        price: product.price,
        currency: product.currency,
        rating: product.rating,
        platform: product.platform,
        seller: product.seller,
        url: product.url
      })
    }
  }
  
  // 计算每个国家的平均价格
  for (const country of Object.keys(countryStats)) {
    const stats = countryStats[country]
    stats.avg_price = stats.count > 0 ? stats.total_value / stats.count : 0
  }
  
  // 按产品数量排序国家
  const sortedCountries = Object.entries(countryStats)
    .sort((a, b) => b[1].count - a[1].count)
    .reduce((obj, [key, value]) => {
      obj[key] = value
      return obj
    }, {})
  
  // Top 产品（按评分和评论数）
  const topProducts = uniqueProducts
    .filter(p => p.rating > 0)
    .sort((a, b) => {
      // 先按评分排序，再按评论数
      if (b.rating !== a.rating) return b.rating - a.rating
      return b.reviews - a.reviews
    })
    .slice(0, 20)
  
  return {
    unique_products: uniqueProducts.length,
    total_value: totalValue,
    avg_price: Math.round(avgPrice * 100) / 100,
    avg_rating: Math.round(avgRating * 10) / 10,
    price_distribution: priceDistribution,
    rating_distribution: ratingDistribution,
    country_breakdown: sortedCountries,
    top_products: topProducts.map(p => ({
      title: p.title,
      price: p.price,
      currency: p.currency,
      rating: p.rating,
      reviews: p.reviews,
      platform: p.platform,
      seller: p.seller,
      url: p.url,
      image: p.image
    }))
  }
}

/**
 * 获取所有品类数据
 */
export const fetchAllCategories = async (options = {}) => {
  if (!CATEGORY_CONFIG) {
    console.error('❌ 品类配置未加载')
    return null
  }
  
  const results = {}
  const categories = Object.keys(CATEGORY_CONFIG.categories)
  
  for (const categoryId of categories) {
    const data = await fetchCategoryData(categoryId, options)
    results[categoryId] = data
    
    // 品类之间间隔
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  return results
}

/**
 * 生成报告
 */
export const generateReport = (data, format = 'json') => {
  if (format === 'json') {
    return JSON.stringify(data, null, 2)
  }
  
  if (format === 'html') {
    return generateHtmlReport(data)
  }
  
  return data
}

/**
 * 生成 HTML 报告
 */
const generateHtmlReport = (data) => {
  const category = CATEGORY_CONFIG?.categories[data.category] || {}
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${category.name_zh || data.category} 销量报告</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: ${category.color || '#333'}; border-bottom: 3px solid ${category.color || '#333'}; padding-bottom: 10px; }
    .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
    .stat-box { background: rgba(255,255,255,0.2); padding: 15px; border-radius: 5px; }
    .stat-label { font-size: 12px; opacity: 0.9; }
    .stat-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #edf2f7; font-weight: bold; }
    tr:hover { background: #f7fafc; }
    .price-tag { color: #48bb78; font-weight: bold; }
    .rating { color: #ecc94b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${category.icon || '💎'} ${category.name_zh || data.category} 销量报告</h1>
    <p>生成时间: ${data.timestamp}</p>
    
    <div class="summary">
      <h2>📊 数据概览</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">总产品数</div>
          <div class="stat-value">${data.analysis?.unique_products || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">总价值</div>
          <div class="stat-value">$${(data.analysis?.total_value || 0).toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">平均价格</div>
          <div class="stat-value">$${data.analysis?.avg_price || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">平均评分</div>
          <div class="stat-value">⭐ ${data.analysis?.avg_rating || 0}</div>
        </div>
      </div>
    </div>
    
    <h2>💰 价格分布</h2>
    <table>
      <tr><th>价格区间</th><th>产品数量</th><th>占比</th></tr>
      <tr><td>Under $100</td><td>${data.analysis?.price_distribution?.under_100 || 0}</td><td>${((data.analysis?.price_distribution?.under_100 || 0) / (data.analysis?.unique_products || 1) * 100).toFixed(1)}%</td></tr>
      <tr><td>$100 - $500</td><td>${data.analysis?.price_distribution?.range_100_500 || 0}</td><td>${((data.analysis?.price_distribution?.range_100_500 || 0) / (data.analysis?.unique_products || 1) * 100).toFixed(1)}%</td></tr>
      <tr><td>$500 - $1000</td><td>${data.analysis?.price_distribution?.range_500_1000 || 0}</td><td>${((data.analysis?.price_distribution?.range_500_1000 || 0) / (data.analysis?.unique_products || 1) * 100).toFixed(1)}%</td></tr>
      <tr><td>Over $1000</td><td>${data.analysis?.price_distribution?.over_1000 || 0}</td><td>${((data.analysis?.price_distribution?.over_1000 || 0) / (data.analysis?.unique_products || 1) * 100).toFixed(1)}%</td></tr>
    </table>
    
    <h2>⭐ Top 产品</h2>
    <table>
      <tr><th>产品名称</th><th>价格</th><th>评分</th><th>评论数</th><th>平台</th></tr>
      ${(data.analysis?.top_products || []).slice(0, 10).map(p => `
        <tr>
          <td><a href="${p.url}" target="_blank">${p.title.substring(0, 60)}...</a></td>
          <td class="price-tag">$${p.price}</td>
          <td class="rating">⭐ ${p.rating}</td>
          <td>${p.reviews}</td>
          <td>${p.platform}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</body>
</html>
  `.trim()
}

// 导出配置
export const getCategories = () => CATEGORY_CONFIG?.categories || {}
export const getDataSources = () => CATEGORY_CONFIG?.data_sources || {}

export default {
  fetchAmazonData,
  fetchCategoryData,
  fetchAllCategories,
  generateReport,
  getCategories,
  getDataSources
}
