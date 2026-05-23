/**
 * 配置加载器
 * 统一管理所有配置文件，支持环境变量覆盖
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置文件路径
const CONFIG_DIR = __dirname

/**
 * 加载 YAML 配置文件
 */
const loadYaml = (filename) => {
  const filepath = path.join(CONFIG_DIR, filename)
  if (fs.existsSync(filepath)) {
    return yaml.load(fs.readFileSync(filepath, 'utf-8'))
  }
  return {}
}

// 加载所有配置文件
const appConfig = loadYaml('app.yaml')
const apiConfig = loadYaml('api.yaml')
const platformsConfig = loadYaml('platforms.yaml')

/**
 * 应用配置（支持环境变量覆盖）
 */
export const app = {
  port: parseInt(process.env.PORT) || appConfig.app?.port || 3000,
  proxyUrl: process.env.HTTP_PROXY || process.env.http_proxy || appConfig.app?.proxy_url || '',
}

/**
 * 数据库配置
 */
export const database = {
  lancedbDir: process.env.LANCEDB_DIR || appConfig.database?.lancedb_dir || './lancedb',
}

/**
 * eBay 配置
 */
export const ebay = {
  env: process.env.EBAY_ENV || appConfig.ebay?.env || 'production',
  appId: process.env.EBAY_APP_ID || process.env.EBAY_API_KEY || appConfig.ebay?.app_id || '',
  certId: process.env.EBAY_CERT_ID || appConfig.ebay?.cert_id || '',
}

/**
 * AI Chat 配置
 */
export const chat = {
  defaultProvider: process.env.CHAT_API_PROVIDER || appConfig.chat?.default_provider || 'glm',
  maxTokens: appConfig.chat?.max_tokens || 1000,
}

/**
 * AI API 提供者配置
 */
export const getApiProviderConfig = (provider) => {
  const config = apiConfig.providers?.[provider]
  if (!config) {
    throw new Error(`未知的 AI 提供者: ${provider}`)
  }
  
  // 从环境变量获取 API Key
  let apiKey = process.env[config.api_key_env] || ''
  if (!apiKey && config.fallback_env) {
    apiKey = process.env[config.fallback_env] || ''
  }
  
  return {
    url: config.url,
    model: config.model,
    apiKey,
    errorMessage: config.error_message,
  }
}

/**
 * 获取所有可用的 AI 提供者列表
 */
export const getAvailableProviders = () => {
  return Object.keys(apiConfig.providers || {})
}

/**
 * Embedding 配置
 */
export const embedding = {
  model: apiConfig.embedding?.model || 'text-embedding-3-small',
  dimensions: apiConfig.embedding?.dimensions || 384,
}

/**
 * 平台 URL 生成
 * @param {string} platform - 平台名称
 * @param {object} params - URL 参数
 * @returns {string} 完整 URL
 */
export const getPlatformUrl = (platform, params = {}) => {
  const config = platformsConfig.platforms?.[platform]
  if (!config || !config.url_template) {
    return ''
  }
  
  let url = config.url_template
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, value)
  }
  return url
}

/**
 * 获取平台配置
 */
export const getPlatformConfig = (platform) => {
  return platformsConfig.platforms?.[platform] || null
}

/**
 * 获取所有平台列表
 */
export const getAllPlatforms = () => {
  return Object.entries(platformsConfig.platforms || {}).map(([key, value]) => ({
    id: key,
    ...value
  }))
}

// 导出原始配置（用于调试）
export const raw = {
  app: appConfig,
  api: apiConfig,
  platforms: platformsConfig,
}

// 启动时打印配置信息
console.log('✅ 配置加载完成:')
console.log(`   - App Port: ${app.port}`)
console.log(`   - Database: ${database.lancedbDir}`)
console.log(`   - Chat Provider: ${chat.defaultProvider}`)
console.log(`   - Available AI Providers: ${getAvailableProviders().join(', ')}`)
