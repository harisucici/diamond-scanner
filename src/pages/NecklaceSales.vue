<template>
  <div class="necklace-sales">
    <!-- 页面标题区 (左对齐 ANTI-CENTER BIAS) -->
    <header class="header">
      <h1 class="header-title">配饰销量排行</h1>
      <p class="header-subtitle">多平台配饰商品与价格；商品列表序号不代表销量</p>
    </header>

    <!-- 控制栏 -->
    <div class="controls">
      <div class="control-group">
        <label>月份</label>
        <input
          type="month"
          v-model="selectedMonth"
          @change="loadData"
          :min="minMonth"
          :max="maxMonth"
          class="control-input"
        />
      </div>

      <div class="control-group">
        <label>品类</label>
        <select v-model="selectedCategory" @change="loadData" class="control-input">
          <option value="">全部品类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
        </select>
      </div>

      <div class="control-group search-group">
        <input
          type="text"
          v-model="searchKeyword"
          placeholder="搜索商品名称、品牌..."
          @input="loadData"
          class="control-input"
        />
      </div>

      <div class="view-toggle">
        <button :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">网格</button>
        <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">列表</button>
        <button :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">表格</button>
      </div>

      <button class="refresh-btn" @click="refreshMonth" :disabled="refreshing">
        {{ refreshing ? '刷新中' : '刷新' }}
      </button>
    </div>

    <!-- 数据源切换 -->
    <div class="source-bar" v-if="stats">
      <div class="source-bar-title">数据源</div>
      <div class="source-list">
        <button
          v-for="s in visibleSources"
          :key="s.id"
          :class="['source-chip', s.enabled ? 'enabled' : 'disabled']"
          @click="toggleSource(s.id)"
        >
          <span class="source-name">{{ s.name }}</span>
          <span class="source-dot">{{ s.enabled ? '●' : '○' }}</span>
        </button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalRecords }}</div>
        <div class="stat-label">数据条目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.totalSales) }}</div>
        <div class="stat-label">已记录销量</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ Object.keys(stats.byWebsite).length || enabledSources.length }}</div>
        <div class="stat-label">购物网站</div>
      </div>
    </div>

    <!-- Loading 遮罩 (刷新) -->
    <div v-if="refreshing" class="loading-overlay">
      <div class="loading-dialog">
        <div class="spinner-large"></div>
        <p>正在刷新 {{ formatMonth(selectedMonth) }} 的数据...</p>
      </div>
    </div>

    <!-- 调试面板 -->
    <div v-if="showDebug && debugLogs.length > 0" class="debug-panel">
      <div class="debug-header">
        <h4>调试信息</h4>
        <button class="debug-close" @click="showDebug = false">×</button>
      </div>
      <div class="debug-content">
        <div
          v-for="(log, index) in debugLogs"
          :key="index"
          class="debug-item"
          :class="log.success ? 'success' : 'error'"
        >
          <div class="debug-title">
            <span class="debug-name">{{ log.name }}</span>
            <span class="debug-status">{{ log.success ? 'OK' : 'FAIL' }}</span>
          </div>
          <div class="debug-info">
            <span>数量: {{ log.count }}</span>
            <span>耗时: {{ log.duration }}ms</span>
          </div>
          <div v-if="log.error" class="debug-error">错误: {{ log.error }}</div>
        </div>
      </div>
    </div>

    <!-- 主数据区 -->
    <div class="data-container">
      <!-- Loading 骨架屏 -->
      <div v-if="loading" class="skeleton-list">
        <div v-for="i in 8" :key="i" class="skeleton-card" :style="{ animationDelay: `${i * 80}ms` }">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
          </div>
          <div class="skeleton-rank"></div>
        </div>
      </div>

      <!-- Empty 空态 -->
      <div v-else-if="filteredData.length === 0" class="empty-state">
        <div class="empty-icon"></div>
        <div class="empty-text">暂无数据</div>
        <div class="empty-hint">请切换月份、品类或刷新数据</div>
      </div>

      <!-- 网格视图 (横向滚动) -->
      <div
        v-else-if="viewMode === 'grid'"
        class="rank-grid"
      >
        <div
          v-for="(item, idx) in filteredData"
          :key="item.id || idx"
          class="rank-card"
          :style="{ animationDelay: `${idx * 100}ms`, '--index': idx }"
          @click="openItemUrl(item.url)"
        >
          <div class="rank-card-image-wrap">
            <img
              v-if="item.image || item.imageUrl || item.image_url"
              :src="item.image || item.imageUrl || item.image_url"
              :alt="item.productName"
              class="rank-card-image"
            />
            <div v-else class="rank-card-image-placeholder"></div>
          </div>

          <div class="rank-card-body">
            <div class="rank-card-source">{{ item._source || item.website || item.platform }}</div>
            <h3 class="rank-card-name">{{ item.productName || item.product_name }}</h3>
            <div class="rank-card-brand">{{ item.brand }}</div>
            <div class="rank-card-meta">
              <span class="rank-card-price">
                {{ formatPrice(item) }}
              </span>
              <span class="rank-card-sales">
                <template v-if="item._source === 'Fashionphile'">—</template>
                <template v-else-if="item._source === 'eBay'">{{ item.condition || '—' }}</template>
                <template v-else>{{ item.sales == null ? '—' : formatNumber(item.sales) }}</template>
              </span>
            </div>
          </div>

        </div>
      </div>

      <!-- 列表视图 (水平滚动卡片) -->
      <div
        v-else-if="viewMode === 'list'"
        class="rank-list"
      >
        <div
          v-for="(item, idx) in filteredData"
          :key="item.id || idx"
          class="rank-row"
          :style="{ animationDelay: `${idx * 100}ms`, '--index': idx }"
          @click="openItemUrl(item.url)"
        >
          <div class="rank-row-image-wrap">
            <img
              v-if="item.image || item.imageUrl || item.image_url"
              :src="item.image || item.imageUrl || item.image_url"
              :alt="item.productName"
              class="rank-row-image"
            />
            <div v-else class="rank-row-image-placeholder"></div>
          </div>

          <div class="rank-row-body">
            <div class="rank-row-source">{{ item._source || item.website || item.platform }}</div>
            <h3 class="rank-row-name">{{ item.productName || item.product_name }}</h3>
            <div class="rank-row-brand">{{ item.brand }}</div>
          </div>

          <div class="rank-row-stats">
            <div class="rank-row-price">
              {{ formatPrice(item) }}
            </div>
            <div class="rank-row-sales">
              <template v-if="item._source === 'Fashionphile'">—</template>
              <template v-else-if="item._source === 'eBay'">{{ item.condition || '—' }}</template>
              <template v-else>{{ item.sales == null ? '—' : formatNumber(item.sales) }}</template>
            </div>
          </div>

        </div>
      </div>

      <!-- 表格视图 -->
      <div v-else-if="viewMode === 'table'" class="rank-table-wrap">
        <table class="rank-table">
          <thead>
            <tr>
              <th class="col-rank">排名</th>
              <th class="col-source">网站</th>
              <th class="col-name">商品名称</th>
              <th class="col-brand">品牌</th>
              <th class="col-price">价格</th>
              <th class="col-sales">销量</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in filteredData"
              :key="item.id || idx"
              :style="{ animationDelay: `${idx * 80}ms` }"
              @click="openItemUrl(item.url)"
              class="rank-table-row"
            >
              <td>
                <span
                  class="rank-num"
                  :class="{ 'rank-gold': item.rank <= 3 }"
                >{{ item.rank }}</span>
              </td>
              <td>{{ item._source || item.website || item.platform }}</td>
              <td>{{ item.productName || item.product_name }}</td>
              <td>{{ item.brand }}</td>
              <td class="mono">
                {{ formatPrice(item) }}
              </td>
              <td class="mono">
                <template v-if="item._source === 'Fashionphile'">—</template>
                <template v-else-if="item._source === 'eBay'">{{ item.condition || '—' }}</template>
                <template v-else>{{ item.sales == null ? '—' : formatNumber(item.sales) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 调试按钮 -->
    <div class="debug-fab">
      <button class="debug-btn" @click="showDebug = !showDebug" title="调试信息">DBG</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'NecklaceSales',
  setup() {
    const loading = ref(false)
    const refreshing = ref(false)
    const viewMode = ref('grid')
    const showDebug = ref(false)
    const debugLogs = ref([])
    const selectedMonth = ref('')
    const selectedCategory = ref('')
    const searchKeyword = ref('')
    const data = ref([])
    const stats = ref(null)
    const availableMonths = ref([])
    const categories = ref([])

    const allSources = ref([
      { id: 'buyma', name: 'BUYMA', enabled: true, api: '/api/necklaces' },
      { id: 'fashionphile', name: 'Fashionphile', enabled: true, api: '/api/fashionphile' },
      { id: 'ebay', name: 'eBay', available: false, enabled: false, api: '/api/ebay' },
      { id: 'allu', name: 'ALLU', enabled: true, api: '/api/allu' },
      { id: 'mejuri', name: 'Mejuri', enabled: true, api: '/api/mejuri' },
      { id: 'rodeo', name: 'Rodeo Drive', enabled: true, api: '/api/rodeo' },
      { id: 'watchnian', name: 'WATCHNIAN', enabled: true, api: '/api/watchnian' },
      { id: 'komehyo', name: 'KOMEHYO', available: false, enabled: false, api: '/api/komehyo' },
      { id: 'rebag', name: 'Rebag', available: false, enabled: false, api: '/api/rebag' },
      { id: 'vestiaire', name: 'Vestiaire Collective', available: false, enabled: false, api: '/api/vestiaire' },
      { id: 'chrono24', name: 'Chrono24', available: false, enabled: false, api: '/api/chrono24' },
      { id: 'grailed', name: 'Grailed', available: false, enabled: false, api: '/api/grailed' },
      { id: 'poshmark', name: 'Poshmark', available: false, enabled: false, api: '/api/poshmark' },
      { id: 'mercarius', name: 'Mercari US', available: false, enabled: false, api: '/api/mercarius' }
    ])

    // Unavailable sources remain configured so they can be restored later.
    const visibleSources = computed(() => allSources.value.filter(s => s.available !== false))
    const enabledSources = computed(() => visibleSources.value.filter(s => s.enabled))

    // 使用 price 作为 sales 替代的数据源列表
    const priceBasedSources = ['Fashionphile', 'eBay', 'KOMEHYO', 'Rebag', 'Vestiaire Collective', 'Chrono24', 'Grailed', 'Poshmark', 'MercariUS', 'ALLU', 'Mejuri', 'Rodeo Drive', 'WATCHNIAN']

    const maxSales = computed(() => {
      if (data.value.length === 0) return 0
      return Math.max(...data.value.map(item => {
        if (priceBasedSources.includes(item._source)) {
          return item.price || 0
        }
        return item.sales || 0
      }))
    })

    const minMonth = computed(() => availableMonths.value[availableMonths.value.length - 1] || '2024-01')
    const maxMonth = computed(() => new Date().toISOString().slice(0, 7))

    const filteredData = computed(() => {
      if (!searchKeyword.value) return data.value || []
      const keyword = searchKeyword.value.toLowerCase()
      return (data.value || []).filter(item =>
        (item.productName || '').toLowerCase().includes(keyword) ||
        (item.brand || '').toLowerCase().includes(keyword) ||
        (item.website || '').toLowerCase().includes(keyword)
      )
    })

    const formatMonth = (month) => {
      const [year, m] = month.split('-')
      return `${year}年${m}月`
    }

    const formatNumber = (num) => {
      if (num === undefined || num === null) return '0'
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    const formatPrice = (item) => {
      if (item.priceRange) return item.priceRange
      const currency = item.currency || (['Fashionphile', 'eBay'].includes(item._source) ? 'USD' : 'JPY')
      return `${currency} ${formatNumber(item.price)}`
    }

    const formatCategory = (cat) => {
      if (!cat) return ''
      const map = {
        'ピアス': 'ピアス (耳钉)',
        'ブレスレット': 'ブレスレット (手链)',
        'ネックレス・チョーカー': '项链',
        '指輪・リング': '戒指',
        'アクセサリーその他': '其他配饰'
      }
      const short = cat.includes('/') ? cat.split('/').pop() : cat
      return map[short] || cat
    }

    const loadCategories = async () => {
      try {
        const response = await fetch(`/api/necklaces/categories/${selectedMonth.value}`)
        categories.value = await response.json()
      } catch (error) {
        console.error('加载品类失败:', error)
      }
    }

    let loadVersion = 0
    const loadData = async () => {
      const version = ++loadVersion
      loading.value = true
      try {
        if (!selectedMonth.value || selectedMonth.value.trim() === '') {
          selectedMonth.value = new Date().toISOString().slice(0, 7)
        }

        await loadCategories()
        if (version !== loadVersion) return

        const allData = []

        // 原有数据源
        if (allData.length === 0) {
          for (const source of enabledSources.value) {
            try {
              let url = ''
              if (source.id === 'buyma') {
                if (selectedCategory.value) {
                  url = `/api/necklaces/category/${selectedMonth.value}/${encodeURIComponent(selectedCategory.value)}`
                } else {
                  url = `${source.api}?month=${selectedMonth.value}`
                }
              } else {
                url = `${source.api}?month=${selectedMonth.value}`
              }

              const response = await fetch(url)
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              const items = await response.json()
              if (!Array.isArray(items)) throw new Error('商品列表格式错误')

              items.forEach((item, i) => {
                const normalizedItem = { ...item, _source: source.name, image: item.image || item.imageUrl || item.image_url }

                if (source.id === 'fashionphile') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                } else if (source.id === 'ebay') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || 'OTHER'
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                  normalizedItem.seller = item.seller
                } else if (source.id === 'vestiaire') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'EUR'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'chrono24') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'komehyo') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || 'OTHER'
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'JPY'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'rebag') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || 'OTHER'
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'grailed') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || item.designer || 'OTHER'
                  normalizedItem.designer = item.designer
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'poshmark') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || 'OTHER'
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                } else if (source.id === 'mercarius') {
                  normalizedItem.productName = item.productName
                  normalizedItem.brand = item.brand || 'OTHER'
                  normalizedItem.price = item.price
                  normalizedItem.currency = item.currency || 'USD'
                  normalizedItem.url = item.url
                  normalizedItem.image = item.imageUrl
                  normalizedItem.condition = item.condition
                }

                allData.push(normalizedItem)
              })
            } catch (e) {
              console.warn(`加载 ${source.name} 失败:`, e)
            }
          }
        }

        // 计算排名
        allData.forEach((item, i) => {
          if (item.rank === undefined) item.rank = i + 1
        })

        if (version !== loadVersion) return
        data.value = allData

        const totalRecords = allData.length
        const totalSales = allData.reduce((sum, item) => sum + (Number(item.sales) || 0), 0)
        stats.value = { totalRecords, totalSales, byWebsite: Object.fromEntries([...new Set(allData.map(item => item._source))].map(name => [name, true])), byCategory: {} }
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        if (version === loadVersion) loading.value = false
      }
    }

    const loadMonths = async () => {
      try {
        const response = await fetch('/api/sources/availability')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const availability = await response.json()
        const ebay = allSources.value.find(source => source.id === 'ebay')
        ebay.available = availability.ebay?.available === true
        ebay.enabled = ebay.available
      } catch (error) {
        console.warn('加载数据源可用状态失败，保留 eBay 为停用状态:', error)
      }
      const currentMonth = new Date().toISOString().slice(0, 7)
      const allMonths = new Set([currentMonth])
      await Promise.all(enabledSources.value.map(async source => {
        try {
          const response = await fetch(`${source.api}/months`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const months = await response.json()
          if (Array.isArray(months)) months.filter(Boolean).forEach(month => allMonths.add(month))
        } catch (error) { console.warn(`加载 ${source.name} 月份失败:`, error) }
      }))
      availableMonths.value = [...allMonths].sort().reverse()
      selectedMonth.value = currentMonth
      await loadData()
    }

    onMounted(() => {
      loadMonths()
    })

    const refreshMonth = async () => {
      refreshing.value = true
      debugLogs.value = []

      const currentMonth = new Date().toISOString().slice(0, 7)
      selectedMonth.value = currentMonth

      try {
        const refreshedData = []

        for (const source of enabledSources.value) {
          const startTime = Date.now()
          try {
            const refreshUrl = `${source.api}/refresh/${currentMonth}`
            const response = await fetch(refreshUrl, { method: 'POST' })
            const result = await response.json()
            const duration = Date.now() - startTime

            debugLogs.value.push({
              name: source.name,
              success: response.ok && result.success === true,
              count: result.count || 0,
              error: result.error || null,
              duration,
              raw: result
            })

            if (result.items && result.items.length > 0) {
              result.items.forEach(item => {
                const normalized = { ...item, _source: source.name, image: item.image || item.imageUrl || item.image_url }
                if (source.id === 'fashionphile') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                } else if (source.id === 'ebay') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || 'OTHER'
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                  normalized.seller = item.seller
                } else if (source.id === 'komehyo') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || 'OTHER'
                  normalized.price = item.price
                  normalized.currency = item.currency || 'JPY'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                } else if (source.id === 'rebag') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || 'OTHER'
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                } else if (source.id === 'grailed') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || item.designer || 'OTHER'
                  normalized.designer = item.designer
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                } else if (source.id === 'poshmark') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || 'OTHER'
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                } else if (source.id === 'mercarius') {
                  normalized.productName = item.productName
                  normalized.brand = item.brand || 'OTHER'
                  normalized.price = item.price
                  normalized.currency = item.currency || 'USD'
                  normalized.url = item.url
                  normalized.image = item.imageUrl
                  normalized.condition = item.condition
                }
                refreshedData.push(normalized)
              })
            }
          } catch (e) {
            debugLogs.value.push({
              name: source.name,
              success: false,
              count: 0,
              error: e.message,
              duration: Date.now() - startTime,
              raw: null
            })
          }
        }

        // Reload persisted snapshots, including retained data for sources that failed.
        await loadData()
        showDebug.value = true

      } catch (error) {
        console.error('刷新数据失败:', error)
      } finally {
        refreshing.value = false
      }
    }

    const openItemUrl = (url) => {
      if (url) window.open(url, '_blank')
    }

    const toggleSource = (sourceId) => {
      const source = allSources.value.find(s => s.id === sourceId)
      if (source && source.available !== false) {
        source.enabled = !source.enabled
        loadData()
      }
    }

    return {
      loading, refreshing, viewMode, selectedMonth, selectedCategory, searchKeyword, data, stats,
      availableMonths, categories, maxSales, minMonth, maxMonth, filteredData, formatMonth, formatNumber, formatCategory,
      loadData, refreshMonth, openItemUrl,
      allSources, visibleSources, enabledSources, toggleSource, formatPrice,
      showDebug, debugLogs
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

.necklace-sales {
  font-family: 'Noto Sans SC', sans-serif;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
  background: #0a0a0f;
  min-height: calc(100vh - 80px);
  color: #f5f5f5;
}

/* 标题区 左对齐 */
.header {
  margin-bottom: 28px;
  text-align: left;
}
.header-title {
  font-size: 2.25rem; /* text-4xl */
  font-weight: 700;
  letter-spacing: -0.025em; /* tracking-tight */
  color: #ffffff;
  margin: 0 0 8px 0;
  line-height: 1.1;
}
.header-subtitle {
  font-size: 1rem;
  color: #9ca3af; /* text-gray-400 */
  margin: 0;
}

/* 控制栏 */
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 20px;
  align-items: center;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-group label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}
.control-input {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  font-size: 0.85rem;
  min-width: 120px;
  font-family: inherit;
  transition: border-color 0.2s;
}
.control-input:focus {
  outline: none;
  border-color: #d4a574;
}
.search-group {
  flex: 1;
  min-width: 200px;
}
.search-group input {
  width: 100%;
  min-width: 200px;
}

.view-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 2px;
}
.view-toggle button {
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.85rem;
  transition: all 0.2s;
  font-family: inherit;
}
.view-toggle button:hover {
  color: #fff;
}
.view-toggle button.active {
  background: #d4a574;
  color: #0a0a0f;
  font-weight: 600;
}

.refresh-btn {
  padding: 8px 18px;
  background: #d4a574;
  color: #0a0a0f;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: opacity 0.2s;
  font-family: inherit;
}
.refresh-btn:hover:not(:disabled) { opacity: 0.9; }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 数据源 */
.source-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.source-bar-title {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.source-list { display: flex; gap: 8px; flex-wrap: wrap; }
.source-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  font-family: inherit;
}
.source-chip.enabled {
  background: rgba(212, 165, 116, 0.15);
  border-color: rgba(212, 165, 116, 0.3);
  color: #d4a574;
}
.source-chip.disabled {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
}
.source-chip:hover { transform: translateY(-1px); }
.source-dot { font-size: 0.6rem; }

/* 统计 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 18px;
  transition: border-color 0.2s;
}
.stat-card:hover { border-color: rgba(212, 165, 116, 0.3); }
.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: #d4a574;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 4px;
}
.stat-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

/* Loading 遮罩 */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.loading-dialog {
  background: #14141a;
  padding: 40px;
  border-radius: 14px;
  text-align: center;
  border: 1px solid rgba(212, 165, 116, 0.3);
}
.spinner-large {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(212, 165, 116, 0.15);
  border-top-color: #d4a574;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  margin: 0 auto 18px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 调试面板 */
.debug-fab { position: fixed; bottom: 20px; right: 20px; z-index: 100; }
.debug-btn {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
}
.debug-btn:hover { background: rgba(255, 255, 255, 0.12); }

.debug-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 560px;
  max-height: 80vh;
  background: #14141a;
  border: 1px solid rgba(212, 165, 116, 0.3);
  border-radius: 12px;
  z-index: 9999;
  overflow: hidden;
}
.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.debug-header h4 { margin: 0; color: #d4a574; font-size: 0.95rem; }
.debug-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
}
.debug-content { padding: 12px; max-height: 60vh; overflow-y: auto; }
.debug-item {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.debug-item.success { border-left: 3px solid #4ade80; }
.debug-item.error { border-left: 3px solid #f87171; }
.debug-title { display: flex; justify-content: space-between; margin-bottom: 6px; }
.debug-name { font-weight: 600; color: #fff; font-size: 0.85rem; }
.debug-status { color: rgba(255, 255, 255, 0.6); font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; }
.debug-info { font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); display: flex; gap: 15px; font-family: 'JetBrains Mono', monospace; }
.debug-error { color: #f87171; font-size: 0.8rem; margin-top: 6px; }

/* 主数据容器 */
.data-container {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 8px 0;
  min-height: 300px;
}

/* 骨架屏 */
.skeleton-list {
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}
.skeleton-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  animation: skeleton-fade 1.4s ease-in-out infinite;
}
.skeleton-card:last-child { border-bottom: none; }
@keyframes skeleton-fade {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
.skeleton-image {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex-shrink: 0;
}
.skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.skeleton-line {
  height: 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.skeleton-line.long { width: 60%; }
.skeleton-line.medium { width: 40%; }
.skeleton-line.short { width: 25%; }
.skeleton-rank {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex-shrink: 0;
}

/* Empty */
.empty-state {
  padding: 80px 20px;
  text-align: center;
}
.empty-icon {
  width: 64px;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 auto 20px;
}
.empty-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}
.empty-hint {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
}

/* 网格视图 */
.rank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0;
  padding: 0 8px;
}
.rank-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08); /* border-white/8 */
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  animation: fade-up 0.5s ease both;
}
.rank-card:hover { background-color: rgba(255, 255, 255, 0.05); }
.rank-card:active { transform: scale(0.99); }

@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.rank-card-image-wrap {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}
.rank-card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 1 / 1;
}
.rank-card-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(212, 165, 116, 0.05));
}

.rank-card-body {
  flex: 1;
  min-width: 0;
}
.rank-card-source {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.rank-card-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
  margin: 0 0 4px 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rank-card-brand {
  font-size: 0.8rem;
  color: #d4a574;
  margin-bottom: 6px;
}
.rank-card-meta {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-family: 'JetBrains Mono', monospace;
}
.rank-card-price {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  transition: color 0.3s;
}
.rank-card-sales {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.rank-card-badge.rank-gold {
  color: #d4a574;
}

/* 列表视图 (水平滚动) */
.rank-list {
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  animation: fade-up 0.5s ease both;
}
.rank-row:last-child { border-bottom: none; }
.rank-row:hover { background-color: rgba(255, 255, 255, 0.05); }
.rank-row:active { transform: scale(0.99); }

.rank-row-image-wrap {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}
.rank-row-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 1 / 1;
}
.rank-row-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(212, 165, 116, 0.05));
}

.rank-row-body { flex: 1; min-width: 0; }
.rank-row-source {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.rank-row-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: #fff;
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-row-brand {
  font-size: 0.78rem;
  color: #d4a574;
}

.rank-row-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
}
.rank-row-price {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  transition: color 0.3s;
}
.rank-row-sales {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.rank-row-badge.rank-gold {
  color: #d4a574;
}

/* 表格视图 */
.rank-table-wrap { overflow-x: auto; }
.rank-table {
  width: 100%;
  border-collapse: collapse;
}
.rank-table th {
  text-align: left;
  padding: 12px 14px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}
.rank-table td {
  padding: 12px 14px;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.rank-table-row {
  cursor: pointer;
  transition: background-color 0.2s;
  animation: fade-up 0.5s ease both;
}
.rank-table-row:hover { background-color: rgba(255, 255, 255, 0.05); }
.rank-table-row:active { transform: scale(0.995); }

.col-rank { width: 70px; }
.col-source { width: 120px; }
.col-brand { width: 120px; }
.col-price, .col-sales { width: 130px; }

.rank-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
}
.rank-num.rank-gold { color: #d4a574; }

.mono {
  font-family: 'JetBrains Mono', monospace;
}

/* 响应式 */
@media (max-width: 768px) {
  .necklace-sales { padding: 20px 14px; }
  .header-title { font-size: 1.6rem; }
  .controls { padding: 12px; gap: 8px; }
  .control-group label { display: none; }
  .stats-row { grid-template-columns: 1fr; }
  .rank-grid { grid-template-columns: 1fr; }
  .col-brand { display: none; }
}
</style>
