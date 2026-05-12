<template>
  <div class="gemstone-fetcher">
    <!-- 页面标题 -->
    <div class="page-title">
      <h1>💎 宝石销量数据获取</h1>
      <p class="subtitle">从 Amazon 获取培育宝石销量数据</p>
    </div>

    <!-- 品类选择 -->
    <div class="category-section">
      <h3>选择品类</h3>
      <div class="category-grid">
        <div
          v-for="(cat, id) in categories"
          :key="id"
          :class="['category-card', { active: selectedCategory === id }]"
          @click="selectedCategory = id"
        >
          <div class="cat-icon">{{ cat.icon }}</div>
          <div class="cat-name">{{ cat.name_zh }}</div>
          <div class="cat-name-en">{{ cat.name_en }}</div>
        </div>
      </div>
    </div>

    <!-- 选项配置 -->
    <div class="options-section">
      <h3>获取选项</h3>
      <div class="options-grid">
        <div class="option-group">
          <label>
            <input type="checkbox" v-model="useEnglishKeywords" />
            使用英文关键词
          </label>
        </div>
        <div class="option-group">
          <label>
            <input type="checkbox" v-model="useChineseKeywords" />
            使用中文关键词
          </label>
        </div>
        <div class="option-group">
          <label>
            <input type="checkbox" v-model="useAmazonCom" />
            Amazon.com
          </label>
        </div>
        <div class="option-group">
          <label>
            <input type="checkbox" v-model="useAmazonJp" />
            Amazon.co.jp
          </label>
        </div>
        <div class="option-group">
          <label>每关键词页数:</label>
          <input type="number" v-model.number="pagesPerKeyword" min="1" max="5" />
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button
        class="fetch-btn"
        @click="fetchData"
        :disabled="fetching || !selectedCategory"
      >
        {{ fetching ? '获取中...' : '🔍 获取数据' }}
      </button>
      <button
        class="fetch-all-btn"
        @click="fetchAllCategories"
        :disabled="fetching"
      >
        {{ fetching ? '获取中...' : '📊 获取所有品类' }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="fetching" class="loading-section">
      <div class="spinner"></div>
      <p>正在从 Amazon 获取数据...</p>
      <p class="progress">{{ progressText }}</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-section">
      <p>❌ {{ error }}</p>
    </div>

    <!-- 结果展示 -->
    <div v-if="result && !fetching" class="result-section">
      <!-- 统计概览 -->
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-value">{{ result.unique_products || 0 }}</div>
          <div class="stat-label">唯一产品数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${{ formatNumber(result.avg_price || 0) }}</div>
          <div class="stat-label">平均价格</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">⭐ {{ result.avg_rating || 0 }}</div>
          <div class="stat-label">平均评分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ result.total_products || 0 }}</div>
          <div class="stat-label">总获取数</div>
        </div>
      </div>

      <!-- Top 产品表格 -->
      <div class="products-table" v-if="result.top_products && result.top_products.length > 0">
        <h3>🏆 Top 产品 (按评分排序)</h3>
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>产品名称</th>
              <th>价格</th>
              <th>评分</th>
              <th>评论数</th>
              <th>平台</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(product, index) in result.top_products" :key="product.asin || index">
              <td>{{ index + 1 }}</td>
              <td class="product-name">
                <img v-if="product.image" :src="product.image" :alt="product.title" class="product-thumb" />
                <span>{{ product.title }}</span>
              </td>
              <td class="price">${{ formatNumber(product.price) }}</td>
              <td class="rating">⭐ {{ product.rating }}</td>
              <td>{{ formatNumber(product.reviews) }}</td>
              <td>{{ product.platform }}</td>
              <td>
                <a :href="product.url" target="_blank" class="view-link">查看</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 导出按钮 -->
      <div class="export-actions">
        <button @click="exportJSON" class="export-btn">📥 导出 JSON</button>
        <button @click="exportCSV" class="export-btn">📥 导出 CSV</button>
      </div>
    </div>

    <!-- 全品类结果 -->
    <div v-if="allResults && !fetching" class="all-results-section">
      <h3>📊 全品类汇总</h3>
      <div class="results-grid">
        <div v-for="(res, catId) in allResults.results" :key="catId" class="result-card">
          <div class="result-header">
            <span class="result-icon">{{ categories[catId]?.icon || '💎' }}</span>
            <span class="result-name">{{ categories[catId]?.name_zh || catId }}</span>
          </div>
          <div class="result-stats">
            <span>产品数: {{ res.unique_products || 0 }}</span>
          </div>
          <button v-if="res.products" @click="showCategoryDetail(catId, res)" class="detail-btn">
            查看详情
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'GemstoneFetcher',
  setup() {
    const categories = ref({})
    const selectedCategory = ref('')
    const useEnglishKeywords = ref(true)
    const useChineseKeywords = ref(true)
    const useAmazonCom = ref(true)
    const useAmazonJp = ref(false)
    const pagesPerKeyword = ref(1)
    const fetching = ref(false)
    const progressText = ref('')
    const error = ref('')
    const result = ref(null)
    const allResults = ref(null)

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/gemstone/categories')
        categories.value = await response.json()
      } catch (e) {
        console.error('加载品类失败:', e)
      }
    }

    const fetchData = async () => {
      if (!selectedCategory.value) return

      fetching.value = true
      error.value = ''
      result.value = null
      allResults.value = null
      progressText.value = `正在获取 ${categories.value[selectedCategory.value]?.name_zh} 数据...`

      const domains = []
      if (useAmazonCom.value) domains.push('amazon.com')
      if (useAmazonJp.value) domains.push('amazon.co.jp')

      try {
        const response = await fetch(`/api/gemstone/fetch/${selectedCategory.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domains,
            pagesPerKeyword: pagesPerKeyword.value,
            useEnglish: useEnglishKeywords.value,
            useChinese: useChineseKeywords.value
          })
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || '获取数据失败')
        }

        result.value = await response.json()
      } catch (e) {
        error.value = e.message
      } finally {
        fetching.value = false
        progressText.value = ''
      }
    }

    const fetchAllCategories = async () => {
      fetching.value = true
      error.value = ''
      result.value = null
      allResults.value = null
      progressText.value = '正在获取所有品类数据...'

      const domains = []
      if (useAmazonCom.value) domains.push('amazon.com')
      if (useAmazonJp.value) domains.push('amazon.co.jp')

      try {
        const response = await fetch('/api/gemstone/fetch-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domains,
            pagesPerKeyword: pagesPerKeyword.value,
            useEnglish: useEnglishKeywords.value,
            useChinese: useChineseKeywords.value
          })
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || '获取数据失败')
        }

        allResults.value = await response.json()
      } catch (e) {
        error.value = e.message
      } finally {
        fetching.value = false
        progressText.value = ''
      }
    }

    const showCategoryDetail = (catId, res) => {
      selectedCategory.value = catId
      result.value = {
        category: catId,
        category_name_zh: categories.value[catId]?.name_zh,
        unique_products: res.unique_products,
        total_products: res.total_products,
        top_products: res.products || []
      }
      allResults.value = null
    }

    const formatNumber = (num) => {
      if (!num) return '0'
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    const exportJSON = () => {
      if (!result.value) return
      const dataStr = JSON.stringify(result.value, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gemstone_${result.value.category}_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    const exportCSV = () => {
      if (!result.value || !result.value.all_products) return
      
      const headers = ['Title', 'Price', 'Currency', 'Rating', 'Reviews', 'Platform', 'ASIN', 'URL']
      const rows = result.value.all_products.map(p => [
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.price || 0,
        p.currency || 'USD',
        p.rating || 0,
        p.reviews || 0,
        p.platform || '',
        p.asin || '',
        p.url || ''
      ])
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gemstone_${result.value.category}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    onMounted(() => {
      loadCategories()
    })

    return {
      categories,
      selectedCategory,
      useEnglishKeywords,
      useChineseKeywords,
      useAmazonCom,
      useAmazonJp,
      pagesPerKeyword,
      fetching,
      progressText,
      error,
      result,
      allResults,
      fetchData,
      fetchAllCategories,
      showCategoryDetail,
      formatNumber,
      exportJSON,
      exportCSV
    }
  }
}
</script>

<style scoped>
.gemstone-fetcher {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  text-align: center;
  margin-bottom: 32px;
}

.page-title h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, #b9f2ff 0%, #50c878 50%, #e0115f 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
}

.category-section {
  margin-bottom: 24px;
}

.category-section h3 {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.category-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.category-card.active {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.2);
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
}

.cat-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.cat-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.cat-name-en {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.options-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.options-section h3 {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.8);
}

.option-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.option-group input[type="number"] {
  width: 60px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  text-align: center;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.fetch-btn, .fetch-all-btn {
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.fetch-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.fetch-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.fetch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fetch-all-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.fetch-all-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.loading-section {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a855f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress {
  color: rgba(255, 255, 255, 0.6);
}

.error-section {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  color: #fca5a5;
}

.result-section {
  margin-top: 32px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: white;
}

.stat-label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}

.products-table {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.products-table h3 {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.products-table table {
  width: 100%;
  border-collapse: collapse;
}

.products-table th,
.products-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.products-table th {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.product-name {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 400px;
}

.product-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
}

.price {
  color: #4ade80;
  font-weight: 600;
}

.rating {
  color: #fbbf24;
}

.view-link {
  color: #60a5fa;
  text-decoration: none;
}

.view-link:hover {
  text-decoration: underline;
}

.export-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.export-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.export-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.all-results-section {
  margin-top: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.all-results-section h3 {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.result-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.result-icon {
  font-size: 1.5rem;
}

.result-name {
  font-weight: 600;
  color: white;
}

.result-stats {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.detail-btn {
  padding: 6px 12px;
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.4);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.detail-btn:hover {
  background: rgba(168, 85, 247, 0.3);
}
</style>
