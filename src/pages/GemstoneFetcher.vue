<template>
  <div class="gemstone-fetcher">
    <!-- 标题区 -->
    <div class="title-area">
      <h1 class="title-main">宝石销量数据检索</h1>
      <p class="title-sub">从 Amazon 获取培育宝石销量数据，支持语义搜索</p>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="输入关键词搜索宝石，如：培育钻石、莫桑石、蓝宝石..."
          @keyup.enter="handleSearch"
        />
        <button
          class="search-btn"
          :disabled="fetching || !searchQuery.trim()"
          @click="handleSearch"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      <!-- 品类筛选器 -->
      <div class="filter-tags" v-if="Object.keys(categories).length > 0">
        <button
          v-for="(cat, id) in categories"
          :key="id"
          :class="['filter-tag', { active: selectedCategory === id }]"
          @click="selectCategory(id)"
        >
          {{ cat.name_zh }}
        </button>
      </div>

      <!-- 高级选项 -->
      <div class="options-toggle" @click="showOptions = !showOptions">
        <span>高级选项</span>
        <svg :class="['chevron', { open: showOptions }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <transition name="slide">
        <div v-if="showOptions" class="options-panel">
          <div class="option-row">
            <label class="option-check">
              <input type="checkbox" v-model="useEnglishKeywords" />
              <span class="check-box"></span>
              <span>英文关键词</span>
            </label>
            <label class="option-check">
              <input type="checkbox" v-model="useChineseKeywords" />
              <span class="check-box"></span>
              <span>中文关键词</span>
            </label>
            <label class="option-check">
              <input type="checkbox" v-model="useAmazonCom" />
              <span class="check-box"></span>
              <span>Amazon.com</span>
            </label>
            <label class="option-check">
              <input type="checkbox" v-model="useAmazonJp" />
              <span class="check-box"></span>
              <span>Amazon.co.jp</span>
            </label>
            <div class="option-number">
              <span>每关键词页数</span>
              <input type="number" v-model.number="pagesPerKeyword" min="1" max="5" />
            </div>
          </div>
          <div class="option-actions">
            <button
              class="btn-fetch"
              :disabled="fetching || (!selectedCategory && !searchQuery.trim())"
              @click="fetchData"
            >
              <svg v-if="!fetching" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <svg v-else class="btn-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>{{ fetching ? '获取中' : '获取数据' }}</span>
            </button>
            <button
              class="btn-fetch-all"
              :disabled="fetching"
              @click="fetchAllCategories"
            >
              <span>{{ fetching ? '获取中' : '获取所有品类' }}</span>
            </button>
          </div>
        </div>
      </transition>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="error-icon">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <span>{{ error }}</span>
      <button class="retry-btn" @click="retryFetch">重试</button>
    </div>

    <!-- 加载状态：骨架屏 -->
    <div v-if="fetching && !result && !allResults" class="skeleton-grid">
      <div v-for="i in 8" :key="i" class="skeleton-card">
        <div class="skeleton-img shimmer"></div>
        <div class="skeleton-text shimmer"></div>
        <div class="skeleton-text short shimmer"></div>
      </div>
    </div>

    <!-- 统计概览 -->
    <div v-if="result && !fetching" class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ result.unique_products || 0 }}</span>
        <span class="stat-label">唯一产品</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">${{ formatNumber(result.avg_price || 0) }}</span>
        <span class="stat-label">平均价格</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ (result.avg_rating || 0).toFixed(1) }}</span>
        <span class="stat-label">平均评分</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ result.total_products || 0 }}</span>
        <span class="stat-label">总获取数</span>
      </div>
      <div class="stat-actions">
        <button class="export-btn" @click="exportJSON" title="导出 JSON">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>JSON</span>
        </button>
        <button class="export-btn" @click="exportCSV" title="导出 CSV">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>CSV</span>
        </button>
      </div>
    </div>

    <!-- 结果网格 -->
    <div v-if="result && !fetching && result.top_products && result.top_products.length > 0" class="results-section">
      <transition-group name="stagger" tag="div" class="results-grid">
        <div
          v-for="(product, index) in result.top_products"
          :key="product.asin || index"
          class="product-card"
          :style="{ '--delay': index * 0.04 + 's' }"
        >
          <div class="card-image-wrap">
            <img
              v-if="product.image"
              :src="product.image"
              :alt="product.title"
              class="card-image"
              loading="lazy"
            />
            <div v-else class="card-image-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div class="card-overlay">
              <a
                :href="product.url"
                target="_blank"
                rel="noopener noreferrer"
                class="card-action-btn"
                @click.stop
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
          <div class="card-body">
            <p class="card-title" :title="product.title">{{ product.title }}</p>
            <div class="card-meta">
              <span class="card-price">${{ formatNumber(product.price) }}</span>
              <span class="card-rating">{{ product.rating }}</span>
            </div>
            <div class="card-footer">
              <span class="card-reviews">{{ formatNumber(product.reviews) }} 评论</span>
              <span class="card-platform">{{ product.platform }}</span>
            </div>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- 空状态 -->
    <div v-else-if="result && !fetching && (!result.top_products || result.top_products.length === 0)" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
      <p class="empty-title">未找到相关宝石</p>
      <p class="empty-desc">尝试更换关键词或选择不同的品类</p>
    </div>

    <!-- 全品类结果 -->
    <div v-if="allResults && !fetching" class="all-results-section">
      <div class="all-results-header">
        <h2>全品类汇总</h2>
        <span class="results-count">{{ Object.keys(allResults.results || {}).length }} 个品类</span>
      </div>
      <transition-group name="stagger" tag="div" class="all-results-grid">
        <div
          v-for="(res, catId) in allResults.results"
          :key="catId"
          class="all-result-card"
          :style="{ '--delay': Object.keys(allResults.results).indexOf(catId) * 0.05 + 's' }"
          @click="showCategoryDetail(catId, res)"
        >
          <div class="all-result-name">{{ categories[catId]?.name_zh || catId }}</div>
          <div class="all-result-count">
            <span class="count-value">{{ res.unique_products || 0 }}</span>
            <span class="count-label">产品</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="all-result-arrow">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'

export default {
  name: 'GemstoneFetcher',
  setup() {
    const categories = ref({})
    const selectedCategory = ref('')
    const searchQuery = ref('')
    const searchInput = ref(null)
    const showOptions = ref(false)
    const useEnglishKeywords = ref(true)
    const useChineseKeywords = ref(true)
    const useAmazonCom = ref(true)
    const useAmazonJp = ref(false)
    const pagesPerKeyword = ref(1)
    const fetching = ref(false)
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

    const selectCategory = (id) => {
      if (selectedCategory.value === id) {
        selectedCategory.value = ''
        return
      }
      selectedCategory.value = id
      const cat = categories.value[id]
      if (cat) {
        searchQuery.value = cat.name_zh
      }
      nextTick(() => handleSearch())
    }

    const handleSearch = () => {
      if (!searchQuery.value.trim()) return
      // 尝试匹配品类
      const matchedId = Object.keys(categories.value).find(
        id => categories.value[id].name_zh === searchQuery.value.trim()
          || categories.value[id].name_en?.toLowerCase() === searchQuery.value.trim().toLowerCase()
      )
      if (matchedId) {
        selectedCategory.value = matchedId
      } else {
        selectedCategory.value = ''
      }
      fetchData()
    }

    const fetchData = async () => {
      if (!selectedCategory.value) return

      fetching.value = true
      error.value = ''
      result.value = null
      allResults.value = null

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
      }
    }

    const fetchAllCategories = async () => {
      fetching.value = true
      error.value = ''
      result.value = null
      allResults.value = null

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
      }
    }

    const retryFetch = () => {
      error.value = ''
      if (selectedCategory.value) {
        fetchData()
      }
    }

    const showCategoryDetail = (catId, res) => {
      selectedCategory.value = catId
      searchQuery.value = categories.value[catId]?.name_zh || catId
      result.value = {
        category: catId,
        category_name_zh: categories.value[catId]?.name_zh,
        unique_products: res.unique_products,
        total_products: res.total_products,
        top_products: res.products || [],
        avg_price: res.avg_price,
        avg_rating: res.avg_rating
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
      searchQuery,
      searchInput,
      showOptions,
      useEnglishKeywords,
      useChineseKeywords,
      useAmazonCom,
      useAmazonJp,
      pagesPerKeyword,
      fetching,
      error,
      result,
      allResults,
      handleSearch,
      selectCategory,
      fetchData,
      fetchAllCategories,
      retryFetch,
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 24px;
  color: #e5e5e5;
}

/* 标题区 */
.title-area {
  margin-bottom: 32px;
}
.title-main {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: #fff;
  margin: 0 0 8px;
  line-height: 1.2;
}
.title-sub {
  font-size: 1rem;
  color: #9ca3af;
  margin: 0;
}

/* 搜索区域 */
.search-section {
  margin-bottom: 32px;
}
.search-bar {
  display: flex;
  align-items: center;
  height: 56px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0 16px;
  transition: border-color 0.2s ease;
}
.search-bar:focus-within {
  border-color: #d4a574;
}
.search-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
  flex-shrink: 0;
  margin-right: 12px;
}
.search-input {
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 1.125rem;
  color: #fff;
  font-family: inherit;
}
.search-input::placeholder {
  color: #6b7280;
}
.search-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: #d4a574;
  color: #1a1a1a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.search-btn svg {
  width: 18px;
  height: 18px;
}
.search-btn:hover:not(:disabled) {
  background: #e0b88a;
}
.search-btn:active:not(:disabled) {
  transform: scale(0.95);
}
.search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 品类筛选器 */
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.filter-tag {
  padding: 6px 16px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #9ca3af;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.filter-tag:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
}
.filter-tag.active {
  background: #d4a574;
  border-color: #d4a574;
  color: #1a1a1a;
  font-weight: 600;
}

/* 高级选项 */
.options-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  width: fit-content;
  transition: color 0.15s ease;
}
.options-toggle:hover {
  color: #d4a574;
}
.chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}
.chevron.open {
  transform: rotate(180deg);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 300px;
}

.options-panel {
  margin-top: 12px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}
.option-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d1d5db;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}
.option-check input {
  display: none;
}
.check-box {
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.option-check input:checked + .check-box {
  background: #d4a574;
  border-color: #d4a574;
}
.option-check input:checked + .check-box::after {
  content: '';
  display: block;
  width: 5px;
  height: 9px;
  border: solid #1a1a1a;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translateY(-1px);
}
.option-number {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d1d5db;
  font-size: 0.875rem;
}
.option-number input {
  width: 56px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  text-align: center;
  font-size: 0.875rem;
  font-family: inherit;
}
.option-number input:focus {
  outline: none;
  border-color: #d4a574;
}

.option-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.btn-fetch,
.btn-fetch-all {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.btn-fetch {
  background: #d4a574;
  color: #1a1a1a;
}
.btn-fetch:hover:not(:disabled) {
  background: #e0b88a;
}
.btn-fetch:active:not(:disabled) {
  transform: scale(0.95);
}
.btn-fetch:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-fetch-all {
  background: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.btn-fetch-all:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}
.btn-fetch-all:active:not(:disabled) {
  transform: scale(0.95);
}
.btn-fetch-all:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-icon {
  width: 16px;
  height: 16px;
}

.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误提示 */
.error-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  margin-bottom: 24px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #fca5a5;
  font-size: 0.875rem;
}
.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #ef4444;
}
.error-bar span {
  flex: 1;
}
.retry-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  flex-shrink: 0;
}
.retry-btn:hover {
  background: rgba(239, 68, 68, 0.25);
}
.retry-btn:active {
  transform: scale(0.95);
}

/* 骨架屏 */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (min-width: 768px) {
  .skeleton-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1024px) {
  .skeleton-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
.skeleton-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
}
.skeleton-img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  margin-bottom: 12px;
}
.skeleton-text {
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  margin-bottom: 8px;
}
.skeleton-text.short {
  width: 60%;
}

.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 统计概览 */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
}
.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
}
.stat-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #9ca3af;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.export-btn svg {
  width: 14px;
  height: 14px;
}
.export-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #d4a574;
  border-color: rgba(212, 165, 116, 0.3);
}
.export-btn:active {
  transform: scale(0.95);
}

/* 结果网格 */
.results-section {
  margin-bottom: 32px;
}
.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (min-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1024px) {
  .results-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.product-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}
.product-card:hover {
  border-color: rgba(212, 165, 116, 0.2);
  transform: translateY(-2px);
}
.card-image-wrap {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}
.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.product-card:hover .card-image {
  transform: scale(1.05);
}
.card-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
}
.card-image-placeholder svg {
  width: 40px;
  height: 40px;
}
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.product-card:hover .card-overlay {
  opacity: 1;
}
.card-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #d4a574;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}
.card-action-btn svg {
  width: 18px;
  height: 18px;
}
.card-action-btn:hover {
  transform: scale(1.1);
}
.card-action-btn:active {
  transform: scale(0.95);
}

.card-body {
  padding: 12px;
}
.card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e5e5e5;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.45em;
}
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.card-price {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #d4a574;
}
.card-rating {
  font-size: 0.8rem;
  color: #d4a574;
  font-weight: 600;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
}

/* Stagger 动画 */
.stagger-enter-active {
  transition: all 0.4s ease;
  transition-delay: var(--delay, 0s);
}
.stagger-leave-active {
  transition: all 0.2s ease;
}
.stagger-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.stagger-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.stagger-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}
.empty-icon {
  width: 56px;
  height: 56px;
  color: #4b5563;
  margin: 0 auto 16px;
}
.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #9ca3af;
  margin: 0 0 6px;
}
.empty-desc {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

/* 全品类结果 */
.all-results-section {
  margin-top: 8px;
}
.all-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.all-results-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}
.results-count {
  font-size: 0.8rem;
  color: #6b7280;
}
.all-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.all-result-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.all-result-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(212, 165, 116, 0.2);
}
.all-result-card:active {
  transform: scale(0.98);
}
.all-result-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e5e5e5;
  flex: 1;
}
.all-result-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.count-value {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: #d4a574;
}
.count-label {
  font-size: 0.7rem;
  color: #6b7280;
}
.all-result-arrow {
  width: 16px;
  height: 16px;
  color: #4b5563;
}

/* 响应式 */
@media (max-width: 768px) {
  .gemstone-fetcher {
    padding: 24px 16px;
  }
  .title-main {
    font-size: 1.75rem;
  }
  .stats-bar {
    gap: 16px;
    padding: 12px 16px;
  }
  .stat-divider {
    display: none;
  }
  .stat-actions {
    margin-left: 0;
    width: 100%;
  }
  .option-row {
    gap: 12px;
  }
  .option-actions {
    flex-direction: column;
  }
  .btn-fetch,
  .btn-fetch-all {
    width: 100%;
    justify-content: center;
  }
}
</style>
