<template>
  <div class="necklace-sales">
    <div class="controls">
      <div class="control-group">
        <label>选择月份:</label>
        <input type="month" v-model="selectedMonth" @change="loadData" :min="minMonth" :max="maxMonth" />
      </div>

      <div class="control-group">
        <label>选择品类:</label>
        <select v-model="selectedCategory" @change="loadData">
          <option value="">全部品类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ formatCategory(cat) }}</option>
        </select>
      </div>

      <div class="control-group">
        <label>展示方式:</label>
        <div class="view-toggle">
          <button :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">📊 表格</button>
          <button :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">🃏 卡片</button>
          <button :class="{ active: viewMode === 'chart' }" @click="viewMode = 'chart'">📈 图表</button>
        </div>
      </div>

      <div class="control-group search-group">
        <input type="text" v-model="searchKeyword" placeholder="搜索商品名称、品牌..." @input="loadData" />
      </div>

      <button class="refresh-btn" @click="refreshMonth" :disabled="refreshing">
        {{ refreshing ? '刷新中...' : '🔄 刷新当月数据' }}
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
          <img v-if="item.image" :src="item.image" :alt="item.productName" class="card-image" />
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
    const selectedMonth = ref('')
    const selectedCategory = ref('')
    const searchKeyword = ref('')
    const data = ref([])
    const stats = ref(null)
    const availableMonths = ref([])
    const categories = ref([])

    const maxSales = computed(() => {
      if (data.value.length === 0) return 0
      return Math.max(...data.value.map(item => item.sales))
    })

    // 可用月份范围 (动态从API获取)
    const minMonth = computed(() => availableMonths.value[0] || '2024-01')
    const maxMonth = computed(() => availableMonths.value[availableMonths.value.length - 1] || '2026-04')

    const filteredData = computed(() => {
      if (!searchKeyword.value) return data.value
      const keyword = searchKeyword.value.toLowerCase()
      return data.value.filter(item =>
        item.productName.toLowerCase().includes(keyword) ||
        item.brand.toLowerCase().includes(keyword) ||
        item.website.toLowerCase().includes(keyword)
      )
    })

    const formatMonth = (month) => {
      const [year, m] = month.split('-')
      return `${year}年${m}月`
    }

    const formatNumber = (num) => {
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

    const loadData = async () => {
      loading.value = true
      try {
        // 加载品类列表
        await loadCategories()
        
        // 根据是否选择品类来请求不同的数据
        let url = `/api/necklaces?month=${selectedMonth.value}`
        if (selectedCategory.value) {
          url = `/api/necklaces/category/${selectedMonth.value}/${encodeURIComponent(selectedCategory.value)}`
        }
        
        const response = await fetch(url)
        data.value = await response.json()
        
        const statsResponse = await fetch(`/api/necklaces/stats/overview?month=${selectedMonth.value}`)
        stats.value = await statsResponse.json()
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
    }

    onMounted(() => {
      loadMonths()
    })

    const refreshMonth = async () => {
      refreshing.value = true
      try {
        const response = await fetch(`/api/necklaces/refresh/${selectedMonth.value}`, {
          method: 'POST'
        })
        const result = await response.json()
        if (result.success) {
          alert(`✅ ${result.message}`)
          await loadData()
        }
      } catch (error) {
        console.error('刷新数据失败:', error)
        alert('❌ 刷新失败')
      } finally {
        refreshing.value = false
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
      availableMonths, categories, maxSales, minMonth, maxMonth, filteredData, formatMonth, formatNumber, formatCategory, loadData, refreshMonth, openItemUrl
    }
  }
}
</script>

<style scoped>
.necklace-sales { font-family: sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f5f7fa; min-height: 100vh; }
.page-header { text-align: center; padding: 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 16px; margin-bottom: 20px; }
.page-header h1 { font-size: 1.8rem; margin-bottom: 10px; }
.subtitle { opacity: 0.9; }
.controls { display: flex; flex-wrap: wrap; gap: 15px; padding: 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.control-group { display: flex; align-items: center; gap: 10px; }
.control-group label { font-weight: 600; }
.control-group select, .control-group input { padding: 10px; border: 1px solid #ddd; border-radius: 8px; min-width: 180px; font-size: 1rem; }
.control-group input[type="month"] { cursor: pointer; }
.search-group input { min-width: 250px; }
.refresh-btn { padding: 10px 20px; background: #48bb78; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
.refresh-btn:hover { background: #38a169; }
.refresh-btn:disabled { background: #a0aec0; cursor: not-allowed; }
.view-toggle { display: flex; }
.view-toggle button { padding: 10px 16px; border: 1px solid #ddd; background: white; cursor: pointer; }
.view-toggle button.active { background: #667eea; color: white; }
.stats-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.stat-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.stat-value { font-size: 1.8rem; font-weight: bold; color: #667eea; }
.stat-label { color: #666; font-size: 0.9rem; }

/* Loading 对话框 */
.loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.loading-dialog { background: white; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
.spinner-large { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
.data-container { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.loading { text-align: center; padding: 60px; }
.spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.table-view { overflow-x: auto; }
.table-view table { width: 100%; border-collapse: collapse; }
.table-view th, .table-view td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
.table-view th { background: #667eea; color: white; }
.rank { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; font-weight: bold; color: white; }
.rank-1 { background: #ffd700; }.rank-2 { background: #c0c0c0; }.rank-3 { background: #cd7f32; }
.rank-4, .rank-5, .rank-6, .rank-7, .rank-8, .rank-9, .rank-10 { background: #667eea; }
.sales { font-weight: bold; color: #e53e3e; }
.card-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.product-card { background: white; border: 2px solid #eee; border-radius: 12px; padding: 20px; position: relative; }
.product-card.rank-1 { border-color: #ffd700; }.product-card.rank-2 { border-color: #c0c0c0; }.product-card.rank-3 { border-color: #cd7f32; }
.card-rank { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 1; }
.product-card.rank-1 .card-rank { background: #ffd700; }
.card-image { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; }
.card-website { font-size: 0.85rem; color: #667eea; margin-bottom: 8px; }
.card-product { font-size: 1rem; margin: 8px 0; color: #333; }
.card-brand, .card-price, .card-sales { margin: 6px 0; color: #555; font-size: 0.9rem; }
.chart-view { padding: 20px; }
.chart-container { background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
.chart-container h3 { margin-bottom: 15px; }
.bar-chart { display: flex; flex-direction: column; gap: 10px; }
.bar-item { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 100px; text-align: right; font-size: 0.9rem; }
.bar-container { flex: 1; height: 24px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
.bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; }
.bar-value { color: white; font-size: 0.85rem; font-weight: bold; }
</style>
