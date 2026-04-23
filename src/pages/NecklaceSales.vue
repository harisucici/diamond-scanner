<template>
  <div class="necklace-sales">
    <!-- 页面标题 -->
    <div class="page-title">
      <h1>💍 日本配饰销量排行</h1>
      <p class="subtitle">日本各大购物平台配饰销量TOP10</p>
    </div>

    <!-- 控制栏 -->
    <div class="controls">
      <div class="control-group">
        <label>📅</label>
        <input type="month" v-model="selectedMonth" @change="loadData" :min="minMonth" :max="maxMonth" />
      </div>

      <div class="control-group">
        <label>🏷️</label>
        <select v-model="selectedCategory" @change="loadData">
          <option value="">全部品类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
        </select>
      </div>

      <div class="control-group search-group">
        <input type="text" v-model="searchKeyword" placeholder="搜索商品名称、品牌..." @input="loadData" />
      </div>

      <div class="view-toggle">
        <button :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">📊</button>
        <button :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">🃏</button>
        <button :class="{ active: viewMode === 'chart' }" @click="viewMode = 'chart'">📈</button>
      </div>

      <div class="source-menu-wrap">
        <button class="source-menu-btn" @click="showSourceMenu = !showSourceMenu">
          📡 数据源 <span class="source-count">{{ enabledSources.length }}</span>
        </button>
        <div v-if="showSourceMenu" class="source-dropdown">
          <label v-for="source in allSources" :key="source.id" class="source-item">
            <input type="checkbox" :checked="source.enabled" @change="toggleSource(source.id)" />
            <span>{{ source.icon }} {{ source.name }}</span>
          </label>
        </div>
      </div>

      <button class="refresh-btn" @click="refreshMonth" :disabled="refreshing">
        {{ refreshing ? '...' : '🔄' }}
      </button>
      <button class="debug-btn" @click="showDebug = !showDebug" title="调试信息">
        🔧
      </button>
    </div>

    <div class="stats-overview" v-if="stats">
      <!-- Loading 对话框 -->
      <div v-if="refreshing" class="loading-overlay">
        <div class="loading-dialog">
          <div class="spinner-large"></div>
          <p>正在刷新 {{ formatMonth(selectedMonth) }} 的数据...</p>
        </div>
      </div>

      <!-- 调试面板 -->
      <div v-if="showDebug && debugLogs.length > 0" class="debug-panel">
        <div class="debug-header">
          <h4>🔧 调试信息</h4>
          <button class="debug-close" @click="showDebug = false">✕</button>
        </div>
        <div class="debug-content">
          <div v-for="(log, index) in debugLogs" :key="index" class="debug-item" :class="log.success ? 'success' : 'error'">
            <div class="debug-title">
              <span class="debug-name">{{ log.name }}</span>
              <span class="debug-status">{{ log.success ? '✅' : '❌' }}</span>
            </div>
            <div class="debug-info">
              <span>数量: {{ log.count }}</span>
              <span>耗时: {{ log.duration }}ms</span>
            </div>
            <div v-if="log.error" class="debug-error">错误: {{ log.error }}</div>
            <pre v-if="log.raw" class="debug-raw">{{ JSON.stringify(log.raw, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-value">{{ stats.totalRecords }}</div>
        <div class="stat-label">数据条目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.totalSales) }}</div>
        <div class="stat-label">总销量</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ Object.keys(stats.byWebsite).length }}</div>
        <div class="stat-label">购物网站</div>
      </div>
    </div>

    <!-- 数据源状态 -->
    <div class="source-status" v-if="sourceStatus.length">
      <div class="source-status-title">📊 数据源状态</div>
      <div class="source-status-grid">
        <div v-for="s in sourceStatus" :key="s.id" :class="['source-status-card', s.hasData ? 'has-data' : 'no-data']">
          <span class="source-icon">{{ getSourceIcon(s.id) }}</span>
          <span class="source-name">{{ s.name }}</span>
          <span class="source-count">{{ s.count }}</span>
        </div>
      </div>
    </div>

    <div class="data-container">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="viewMode === 'table'" class="table-view">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>网站</th>
              <th>商品名称</th>
              <th>品牌</th>
              <th>价格</th>
              <th>销量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredData" :key="item.id" @click="openItemUrl(item.url)" style="cursor: pointer" title="点击查看商品详情">
              <td><span class="rank" :class="'rank-' + item.rank">{{ item.rank }}</span></td>
              <td>{{ item.website }}</td>
              <td>{{ item.productName }}</td>
              <td>{{ item.brand }}</td>
              <td>{{ item.priceRange }}</td>
              <td class="sales">{{ formatNumber(item.sales) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="viewMode === 'card'" class="card-view">
        <div 
          v-for="item in filteredData" 
          :key="item.id" 
          class="product-card" 
          :class="'rank-' + item.rank"
          @click="openItemUrl(item.url)"
          style="cursor: pointer"
          title="点击查看商品详情"
        >
          <div class="card-rank">{{ item.rank }}</div>
          <div class="card-image-wrap">
            <img v-if="item.image" :src="item.image" :alt="item.productName" class="card-image" />
          </div>
          <div class="card-content">
            <div class="card-website">{{ item.website }}</div>
            <h3 class="card-product">{{ item.productName }}</h3>
            <div class="card-brand">🏷️ {{ item.brand }}</div>
            <div class="card-price">💰 {{ item.priceRange }}</div>
            <div class="card-sales">📈 销量: {{ formatNumber(item.sales) }}</div>
          </div>
        </div>
      </div>

      <div v-else-if="viewMode === 'chart'" class="chart-view">
        <div class="chart-container">
          <h3>📊 销量排名TOP10</h3>
          <div class="bar-chart">
            <div v-for="item in filteredData" :key="item.id" class="bar-item">
              <div class="bar-label">{{ item.rank }}. {{ item.brand }}</div>
              <div class="bar-container">
                <div class="bar" :style="{ width: (item.sales / maxSales * 100) + '%' }">
                  <span class="bar-value">{{ formatNumber(item.sales) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
    const viewMode = ref('table')
    const showDebug = ref(false)
    const debugLogs = ref([])
    const selectedMonth = ref('')
    const selectedCategory = ref('')
    const searchKeyword = ref('')
    const data = ref([])
    const stats = ref(null)
    const availableMonths = ref([])
    const categories = ref([])
    const showSourceMenu = ref(false)
    const sourceStatus = ref([])

    // 数据源配置 (默认只启用BUYMA)
    const allSources = ref([
      { id: 'buyma', name: 'BUYMA', icon: '🛍️', enabled: true, api: '/api/necklaces' },
      { id: 'rakuten', name: '樂天', icon: '🏮', enabled: false, api: '/api/rakuten' },
      { id: 'mercari', name: 'メルカリ', icon: '📱', enabled: false, api: '/api/mercari' },
      { id: 'yahoo-auction', name: 'Yahoo!拍賣', icon: '🔨', enabled: false, api: '/api/yahoo-auction' }
    ])

    // 启用的数据源
    const enabledSources = computed(() => allSources.value.filter(s => s.enabled))

    const maxSales = computed(() => {
      if (data.value.length === 0) return 0
      return Math.max(...data.value.map(item => item.sales))
    })

    // 可用月份范围 (动态从API获取)
    const minMonth = computed(() => availableMonths.value[0] || '2024-01')
    const maxMonth = computed(() => availableMonths.value[availableMonths.value.length - 1] || '2026-04')

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

    // 品类格式化
    const formatCategory = (cat) => {
      if (!cat) return ''
      const map = {
        'ピアス': 'ピアス (耳钉)',
        'ブレスレット': 'ブレスレット (手链)',
        'ネックレス・チョーカー': '项链',
        '指輪・リング': '戒指',
        'アクセサリーその他': '其他配饰'
      }
      // 支持完整路径或短名称
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

    // 加载数据源状态
    const loadSourceStatus = async () => {
      try {
        const response = await fetch('/api/sources/status')
        sourceStatus.value = await response.json()
      } catch (error) {
        console.error('加载数据源状态失败:', error)
      }
    }

    // 获取数据源图标
    const getSourceIcon = (id) => {
      const source = allSources.value.find(s => s.id === id)
      return source?.icon || '📦'
    }

    const loadData = async () => {
      loading.value = true
      try {
        // 加载品类列表
        await loadCategories()
        
        // 从所有启用的数据源加载数据
        const allData = []
        
        for (const source of enabledSources.value) {
          try {
            let url = `${source.api}?month=${selectedMonth.value}`
            if (selectedCategory.value && source.id === 'buyma') {
              url = `/api/necklaces/category/${selectedMonth.value}/${encodeURIComponent(selectedCategory.value)}`
            }
            
            const response = await fetch(url)
            const items = await response.json()
            
            // 为每个数据添加来源标识
            items.forEach(item => {
              allData.push({ ...item, _source: source.name })
            })
          } catch (e) {
            console.warn(`加载 ${source.name} 失败:`, e)
          }
        }
        
        data.value = allData
        
        // 计算统计信息
        const totalRecords = allData.length
        const totalSales = allData.reduce((sum, item) => sum + (item.sales || item.price || 0), 0)
        stats.value = {
          totalRecords,
          totalSales,
          byWebsite: {},
          byCategory: {}
        }
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        loading.value = false
      }
    }

    const loadMonths = async () => {
      // 从API获取可用月份
      try {
        const response = await fetch('/api/necklaces/months')
        availableMonths.value = await response.json()
        // 默认选中最新月份
        selectedMonth.value = availableMonths.value[availableMonths.value.length - 1] || ''
      } catch (error) {
        console.error('加载月份失败:', error)
        selectedMonth.value = maxMonth.value
      }
      await loadData()
      await loadSourceStatus()
    }

    onMounted(() => {
      loadMonths()
    })

    const refreshMonth = async () => {
      refreshing.value = true
      debugLogs.value = [] // 清空日志
      try {
        // 刷新所有启用的数据源
        for (const source of enabledSources.value) {
          const startTime = Date.now()
          try {
            const response = await fetch(`${source.api}/refresh/${selectedMonth.value}`, {
              method: 'POST'
            })
            const result = await response.json()
            const duration = Date.now() - startTime
            debugLogs.value.push({
              name: source.name,
              success: result.success,
              count: result.count || 0,
              error: result.error || null,
              duration,
              raw: result
            })
            console.log(`${source.name} 刷新:`, result.success ? '成功' : '失败')
          } catch (e) {
            debugLogs.value.push({
              name: source.name,
              success: false,
              count: 0,
              error: e.message,
              duration: Date.now() - startTime,
              raw: null
            })
            console.warn(`刷新 ${source.name} 失败:`, e)
          }
        }
        
        await loadData()
      } catch (error) {
        console.error('刷新数据失败:', error)
      } finally {
        refreshing.value = false
      }
    }

    // 切换数据源
    const toggleSource = (sourceId) => {
      const source = allSources.value.find(s => s.id === sourceId)
      if (source) {
        source.enabled = !source.enabled
        loadData()
      }
    }

    // 打开商品链接
    const openItemUrl = (url) => {
      if (url) {
        window.open(url, '_blank')
      }
    }

    return {
      loading, refreshing, viewMode, selectedMonth, selectedCategory, searchKeyword, data, stats,
      availableMonths, categories, maxSales, minMonth, maxMonth, filteredData, formatMonth, formatNumber, formatCategory, loadData, refreshMonth, openItemUrl,
      allSources, enabledSources, toggleSource, showSourceMenu, sourceStatus, loadSourceStatus, getSourceIcon,
      showDebug, debugLogs
    }
  }
}
</script>

<style scoped>
.necklace-sales { font-family: sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%); min-height: calc(100vh - 80px); color: #fff; }

/* 页面标题 */
.page-title { text-align: center; margin-bottom: 24px; }
.page-title h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #00d4ff, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.page-title .subtitle { color: rgba(255,255,255,0.5); font-size: 1rem; }
.controls { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 20px; background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border-radius: 20px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.3); align-items: center; justify-content: center; position: relative; z-index: 1; }
.control-group { display: flex; align-items: center; gap: 6px; }
.control-group label { font-weight: 500; color: rgba(255,255,255,0.7); font-size: 0.85rem; }
.control-group select, .control-group input { padding: 8px 12px; border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; min-width: 120px; font-size: 0.85rem; background: rgba(255,255,255,0.08); color: #fff; }
.control-group input[type="month"] { cursor: pointer; }
.search-group input { min-width: 250px; }
.refresh-btn { padding: 8px 14px; background: linear-gradient(135deg, #00d4ff, #667eea); color: white; border: none; border-radius: 16px; cursor: pointer; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 15px rgba(0,212,255,0.3); }
.refresh-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,212,255,0.5); }
.refresh-btn:disabled { background: #444; cursor: not-allowed; transform: none; box-shadow: none; }
.view-toggle { display: flex; background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); border-radius: 16px; padding: 4px; }
.view-toggle button { padding: 8px 12px; border: none; background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; border-radius: 12px; transition: all 0.3s ease; font-size: 1rem; }
.view-toggle button:hover { color: #fff; }
.view-toggle button.active { background: linear-gradient(135deg, #00d4ff, #667eea); color: white; font-weight: 600; box-shadow: 0 4px 15px rgba(0,212,255,0.3); }

.source-menu-wrap { position: relative; }
.source-menu-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.4); color: #fff; border-radius: 16px; cursor: pointer; font-size: 0.85rem; transition: all 0.3s; }
.source-menu-btn:hover { background: rgba(102, 126, 234, 0.3); }
.source-count { background: #00d4ff; color: #000; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; }
.source-dropdown { position: absolute; top: 100%; right: 0; margin-top: 8px; background: rgba(15, 12, 41, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 12px; padding: 10px; z-index: 9999; min-width: 160px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); }
.source-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
.source-item:hover { background: rgba(102, 126, 234, 0.2); }
.source-item input { accent-color: #667eea; width: 16px; height: 16px; }
.source-item span { color: rgba(255, 255, 255, 0.9); font-size: 0.85rem; }
.stats-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.stat-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); padding: 20px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease; }
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.stat-value { font-size: 1.8rem; font-weight: bold; background: linear-gradient(135deg, #00d4ff, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-label { color: rgba(255,255,255,0.6); font-size: 0.9rem; }

/* 数据源状态 */
.source-status { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border-radius: 16px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); }
.source-status-title { font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 12px; font-weight: 500; }
.source-status-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.source-status-card { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; font-size: 0.8rem; }
.source-status-card.has-data { background: rgba(0, 212, 255, 0.15); border: 1px solid rgba(0, 212, 255, 0.3); }
.source-status-card.no-data { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); opacity: 0.6; }
.source-icon { font-size: 1rem; }
.source-name { color: rgba(255,255,255,0.9); }
.source-count { color: #00d4ff; font-weight: bold; }

/* Loading 对话框 */
.loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.loading-dialog { background: linear-gradient(135deg, #1a1a2e, #302b63); padding: 40px; border-radius: 20px; text-align: center; border: 1px solid rgba(0,212,255,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.spinner-large { width: 50px; height: 50px; border: 4px solid rgba(0,212,255,0.2); border-top: 4px solid #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
.data-container { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border-radius: 20px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.loading { text-align: center; padding: 60px; color: rgba(255,255,255,0.6); }
.spinner { width: 50px; height: 50px; border: 4px solid rgba(0,212,255,0.2); border-top: 4px solid #00d4ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.table-view { overflow-x: auto; }
.table-view table { width: 100%; border-collapse: collapse; }
.table-view th, .table-view td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
.table-view th { background: rgba(102,126,234,0.3); color: #fff; }
.rank { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; font-weight: bold; color: white; }
.rank-1 { background: #ffd700; }.rank-2 { background: #c0c0c0; }.rank-3 { background: #cd7f32; }
.rank-4, .rank-5, .rank-6, .rank-7, .rank-8, .rank-9, .rank-10 { background: linear-gradient(135deg, #667eea, #764ba2); }
.sales { font-weight: bold; color: #667eea; }
.card-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.product-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 0; position: relative; overflow: hidden; transition: all 0.3s ease; }
.product-card:hover { transform: translateY(-6px); box-shadow: 0 16px 40px rgba(0,0,0,0.4); border-color: rgba(0,212,255,0.3); }
.product-card.rank-1 { border-color: rgba(255,215,0,0.4); box-shadow: 0 0 25px rgba(255,215,0,0.15); }.product-card.rank-2 { border-color: rgba(192,192,192,0.4); }.product-card.rank-3 { border-color: rgba(205,127,50,0.4); }

.card-rank { position: absolute; top: 10px; left: 10px; width: 32px; height: 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; z-index: 2; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
.product-card.rank-1 .card-rank { background: linear-gradient(135deg, #ffd700, #ffb700); color: #1a1a2e; }
.product-card.rank-2 .card-rank { background: linear-gradient(135deg, #c0c0c0, #a8a8a8); color: #1a1a2e; }
.product-card.rank-3 .card-rank { background: linear-gradient(135deg, #cd7f32, #b87333); color: #fff; }

.card-image-wrap { position: relative; overflow: hidden; }
.card-image { width: 100%; height: 160px; object-fit: cover; transition: transform 0.3s ease; }
.product-card:hover .card-image { transform: scale(1.05); }

.card-content { padding: 14px; }
.card-website { font-size: 0.7rem; color: #00d4ff; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.card-product { font-size: 0.85rem; margin: 6px 0; color: #fff; line-height: 1.4; min-height: 36px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-brand { color: #a855f7; font-size: 0.75rem; font-weight: 500; margin-bottom: 8px; }
.card-price { color: #00d4ff; font-weight: 700; font-size: 1rem; margin-bottom: 6px; }
.card-sales { color: rgba(255,255,255,0.4); font-size: 0.7rem; }
.chart-view { padding: 20px; }
.chart-container { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); padding: 20px; border-radius: 20px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); }
.chart-container h3 { margin-bottom: 15px; color: #fff; }
.bar-chart { display: flex; flex-direction: column; gap: 10px; }
.bar-item { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 100px; text-align: right; font-size: 0.9rem; color: rgba(255,255,255,0.7); }
.bar-container { flex: 1; height: 24px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
.bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; }
.bar-value { color: white; font-size: 0.85rem; font-weight: bold; }

/* 调试面板 */
.debug-btn { padding: 8px 14px; background: #444; color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 0.85rem; }
.debug-btn:hover { background: #555; }
.debug-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 600px; max-height: 80vh; background: #1a1a2e; border: 1px solid #00d4ff; border-radius: 12px; z-index: 9999; overflow: hidden; }
.debug-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,212,255,0.1); border-bottom: 1px solid #333; }
.debug-header h4 { margin: 0; color: #00d4ff; }
.debug-close { background: none; border: none; color: #fff; font-size: 1.2rem; cursor: pointer; }
.debug-content { padding: 12px; max-height: 60vh; overflow-y: auto; }
.debug-item { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.debug-item.success { border-left: 3px solid #00ff00; }
.debug-item.error { border-left: 3px solid #ff4444; }
.debug-title { display: flex; justify-content: space-between; margin-bottom: 6px; }
.debug-name { font-weight: bold; color: #fff; }
.debug-info { font-size: 0.85rem; color: #aaa; display: flex; gap: 15px; }
.debug-error { color: #ff4444; font-size: 0.85rem; margin-top: 6px; }
.debug-raw { background: #111; padding: 8px; border-radius: 4px; font-size: 0.75rem; color: #0f0; overflow-x: auto; margin-top: 8px; }

/* 响应式布局 */
@media (max-width: 768px) {
  .necklace-sales { padding: 12px; }
  .page-title h1 { font-size: 1.6rem; }
  .controls { padding: 12px; gap: 8px; justify-content: flex-start; overflow-x: auto; }
  .control-group { flex-shrink: 0; }
  .control-group label { display: none; }
  .control-group select, .control-group input { min-width: 100px; padding: 6px 10px; }
  .search-group { flex: 1; min-width: 120px; }
  .search-group input { width: 100%; }
  .view-toggle button { padding: 6px 10px; font-size: 0.9rem; }
  .refresh-btn { padding: 6px 10px; }
  .stats-overview { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat-card { padding: 10px; }
  .stat-value { font-size: 1.2rem; }
  .card-view { grid-template-columns: repeat(2, 1fr); gap: 12px; }
}
</style>
