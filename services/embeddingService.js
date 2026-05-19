/**
 * 向量生成服务
 * 使用 GROQ API 生成文本嵌入向量
 */

import fetch from 'node-fetch'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_API_URL = 'https://api.groq.com/openai/v1/embeddings'

// 缓存向量结果
const vectorCache = new Map()

/**
 * 生成文本嵌入向量
 * 使用 GROQ API 或本地模型
 * 
 * @param {string} text - 要生成向量的文本
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<number[]>} - 384维向量
 */
export const generateEmbedding = async (text, useCache = true) => {
  // 检查缓存
  const cacheKey = text.trim().toLowerCase()
  if (useCache && vectorCache.has(cacheKey)) {
    return vectorCache.get(cacheKey)
  }
  
  // 如果有 GROQ API Key，使用 GROQ
  if (GROQ_API_KEY) {
    try {
      const vector = await generateGroqEmbedding(text)
      if (useCache) {
        vectorCache.set(cacheKey, vector)
      }
      return vector
    } catch (error) {
      console.warn('GROQ embedding failed, using fallback:', error.message)
    }
  }
  
  // 回退：使用简单的哈希向量生成
  const vector = generateSimpleVector(text)
  if (useCache) {
    vectorCache.set(cacheKey, vector)
  }
  return vector
}

/**
 * 使用 GROQ API 生成嵌入向量
 */
const generateGroqEmbedding = async (text) => {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'nomic-embed-text-v1.5',
      input: text
    })
  })
  
  if (!response.ok) {
    throw new Error(`GROQ API error: ${response.status}`)
  }
  
  const data = await response.json()
  const embedding = data.data[0].embedding
  
  // 调整向量维度到 384（如果需要）
  return normalizeVector(embedding.slice(0, 384))
}

/**
 * 简单向量生成（回退方案）
 * 使用文本特征生成伪向量
 */
const generateSimpleVector = (text) => {
  const vector = new Float32Array(384)
  const normalizedText = text.toLowerCase().trim()
  
  // 基于字符频率生成向量
  for (let i = 0; i < 384; i++) {
    let sum = 0
    for (let j = 0; j < normalizedText.length; j++) {
      const charCode = normalizedText.charCodeAt(j)
      sum += Math.sin(charCode * (i + 1) * 0.01) + Math.cos(charCode * (i + 1) * 0.02)
    }
    vector[i] = sum / normalizedText.length
  }
  
  return normalizeVector(Array.from(vector))
}

/**
 * 归一化向量
 */
const normalizeVector = (vector) => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (magnitude === 0) return vector
  return vector.map(val => val / magnitude)
}

/**
 * 批量生成向量
 * @param {string[]} texts - 文本数组
 * @param {number} batchSize - 批次大小
 * @returns {Promise<number[][]>} - 向量数组
 */
export const generateBatchEmbeddings = async (texts, batchSize = 10) => {
  const results = []
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchVectors = await Promise.all(
      batch.map(text => generateEmbedding(text))
    )
    results.push(...batchVectors)
    
    // 进度日志
    if ((i + batchSize) % 50 === 0 || i + batchSize >= texts.length) {
      console.log(`📊 向量生成进度: ${Math.min(i + batchSize, texts.length)}/${texts.length}`)
    }
    
    // 避免API限流
    if (GROQ_API_KEY && i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * 计算余弦相似度
 */
export const cosineSimilarity = (vec1, vec2) => {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length')
  }
  
  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    magnitude1 += vec1[i] * vec1[i]
    magnitude2 += vec2[i] * vec2[i]
  }
  
  magnitude1 = Math.sqrt(magnitude1)
  magnitude2 = Math.sqrt(magnitude2)
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0
  }
  
  return dotProduct / (magnitude1 * magnitude2)
}

/**
 * 清除向量缓存
 */
export const clearCache = () => {
  vectorCache.clear()
  console.log('🧹 向量缓存已清除')
}

/**
 * 获取缓存大小
 */
export const getCacheSize = () => {
  return vectorCache.size
}

export default {
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
  clearCache,
  getCacheSize
}
