<template>
  <div class="semantic-search">
    <div class="search-header">
      <h2>🔍 语义搜索</h2>
      <p class="search-desc">使用自然语言搜索产品，AI会理解您的需求</p>
    </div>
    
    <div class="search-controls">
      <div class="search-input-group">
        <input 
          v-model="searchQuery" 
          @keyup.enter="performSearch"
          type="text" 
          placeholder="例如: 我想要一个经典品牌的项链..."
          class="search-input"
        />
        <button @click="performSearch" :disabled="loading" class="search-btn">
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
      </div>
      
      <div class="search-options">
        <label>
          平台筛选:
          <select v-model="selectedPlatform">
            <option value="">全部</option>
            <option value="jewelry">珠宝</option>
            <option value="ebay">eBay</option>
            <option value="fashionphile">Fashionphile</option>
            <option value="etsy">Etsy</option>
            <option value="mercari">Mercari</option>
          </select>
        </label>
        
        <label>
          结果数量:
          <select v-model="resultLimit">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
    </div>
    
    <div v-if="error" class="search-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="results.length > 0" class="search-results">
      <div class="results-header">
        <h3>找到 {{ results.length }} 个相关产品</h3>
        <span class="query-info">搜索: "{{ lastQuery }}"</span>
      </div>
      
      <div class="results-grid">
        <div v-for="product in results" :key="product.id" class="product-card">
          <div class="product-image">
            <img v-if="product.image_url" :src="product.image_url" :alt="product.product_name" />
            <div v-else class="no-image">📷</div>
          </div>
          
          <div class="product-info">
            <h4 class="product-name">{{ product.product_name }}</h4>
            <p class="product-brand">{{ product.brand }}</p>
            <p class="product-price">
              {{ product.currency }} {{ product.price?.toLocaleString() }}
            </p>
            <p class="product-category">{{ product.category }}</p>
            <p class="product-platform">📍 {{ product.platform }}</p>
            
            <div class="product-similarity">
              <span class="similarity-label">相似度:</span>
              <span class="similarity-value">{{ (product.similarity * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="product-actions">
              <button @click="viewSimilar(product.id)" class="similar-btn">
                看相似产品
              </button>
              <a v-if="product.url" :href="product.url" target="_blank" class="view-link">
                查看详情 ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="!loading && searchQuery" class="no-results">
      <p>没有找到相关产品，请尝试不同的搜索词</p>
    </div>
    
    <!-- 相似产品弹窗 -->
    <div v-if="showSimilarModal" class="modal-overlay" @click="showSimilarModal = false">
      <div class="modal-content">
        <h3>相似产品推荐</h3>
        <div v-if="similarProducts.length > 0" class="similar-grid">
          <div v-for="product in similarProducts" :key="product.id" class="similar-card">
            <img v-if="product.image_url" :src="product.image_url" />
            <p>{{ product.product_name }}</p>
            <p>{{ product.brand }}</p>
            <p>{{ (product.similarity * 100).toFixed(1) }}% 相似</p>
          </div>
        </div>
        <div v-else class="loading-similar">加载中...</div>
        <button @click="showSimilarModal = false" class="close-btn">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SemanticSearch',
  data() {
    return {
      searchQuery: '',
      selectedPlatform: '',
      resultLimit: 10,
      loading: false,
      error: null,
      results: [],
      lastQuery: '',
      showSimilarModal: false,
      similarProducts: [],
      apiUrl: '/api/lancedb'
    }
  },
  methods: {
    async performSearch() {
      if (!this.searchQuery.trim()) return
      
      this.loading = true
      this.error = null
      this.lastQuery = this.searchQuery
      
      try {
        const response = await fetch(`${this.apiUrl}/search/semantic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: this.searchQuery,
            limit: parseInt(this.resultLimit),
            platform: this.selectedPlatform || undefined
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          this.results = data.data.results
        } else {
          this.error = data.error || '搜索失败'
        }
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
    
    async viewSimilar(productId) {
      this.showSimilarModal = true
      this.similarProducts = []
      
      try {
        const response = await fetch(`${this.apiUrl}/products/${productId}/similar?limit=5`)
        const data = await response.json()
        
        if (data.success) {
          this.similarProducts = data.data.similar
        }
      } catch (e) {
        console.error('获取相似产品失败:', e)
      }
    }
  }
}
</script>

<style scoped>
.semantic-search {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.search-header {
  text-align: center;
  margin-bottom: 30px;
}

.search-header h2 {
  color: #333;
  margin-bottom: 10px;
}

.search-desc {
  color: #666;
  font-size: 14px;
}

.search-controls {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
}

.search-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.search-input:focus {
  border-color: #4a90d9;
  outline: none;
}

.search-btn {
  padding: 15px 30px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.search-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.search-options {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.search-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #555;
}

.search-options select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-error {
  background: #ffe0e0;
  color: #c00;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.search-results {
  margin-top: 20px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.product-card:hover {
  transform: translateY(-5px);
}

.product-image {
  height: 200px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  font-size: 60px;
  color: #999;
}

.product-info {
  padding: 15px;
}

.product-name {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.3;
}

.product-brand {
  color: #666;
  font-size: 14px;
  margin-bottom: 5px;
}

.product-price {
  color: #e74c3c;
  font-weight: bold;
  margin-bottom: 5px;
}

.product-category {
  color: #888;
  font-size: 12px;
}

.product-platform {
  color: #4a90d9;
  font-size: 12px;
}

.product-similarity {
  margin-top: 10px;
  padding: 5px 10px;
  background: #e8f4ea;
  border-radius: 4px;
}

.similarity-value {
  color: #2ecc71;
  font-weight: bold;
}

.product-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.similar-btn {
  padding: 8px 15px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.view-link {
  padding: 8px 15px;
  background: #95a5a6;
  color: white;
  border-radius: 4px;
  text-decoration: none;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #666;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
}

.similar-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-top: 20px;
}

.similar-card {
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.similar-card img {
  width: 100%;
  height: 100px;
  object-fit: contain;
}

.close-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.loading-similar {
  text-align: center;
  padding: 20px;
  color: #666;
}
</style>