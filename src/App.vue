<template>
  <div class="app">
    <nav class="main-nav">
      <div class="nav-brand">
        <h1>💎 Diamond Scanner</h1>
      </div>
      <div class="nav-links">
        <a 
          href="#" 
          :class="{ active: currentPage === 'diamonds' }" 
          @click.prevent="currentPage = 'diamonds'"
        >
          💎 钻石管理
        </a>
        <a 
          href="#" 
          :class="{ active: currentPage === 'necklaces' }" 
          @click.prevent="currentPage = 'necklaces'"
        >
          📿 项链销量排行
        </a>
      </div>
    </nav>

    <!-- 钻石管理页面 -->
    <div v-if="currentPage === 'diamonds'" class="page-content">
      <div class="app">
    <header>
      <h1>💎 Diamond Scanner</h1>
      <p class="subtitle">A Vue.js application with JSON database</p>
      
      <!-- 快捷入口 -->
      <div class="quick-entry">
        <button @click="goToNecklaces" class="quick-btn">
          📿 查看日本项链销量排行 →
        </button>
      </div>
    </header>
    
    <main>
      <div class="hello-section">
        <h2>Hello World!</h2>
        <p>Welcome to the Diamond Scanner application.</p>
        <p>This is a Vue.js project ready for deployment to Render.</p>
      </div>

      <div class="database-section">
        <h3>Database Status</h3>
        <p v-if="dbStatus">{{ dbStatus }}</p>
        <button @click="checkDatabase">Check Database</button>
        <button @click="addSampleData">Add Sample Data</button>
      </div>

      <div v-if="diamonds.length > 0" class="data-section">
        <h3>Diamond Records ({{ diamonds.length }})</h3>
        <ul>
          <li v-for="diamond in diamonds" :key="diamond.id">
            {{ diamond.carat }}ct {{ diamond.color }} {{ diamond.clarity }} - ${{ diamond.price }}
            <button @click="deleteDiamond(diamond.id)" class="delete-btn">Delete</button>
          </li>
        </ul>
      </div>

      <div class="api-test">
        <h3>API Test</h3>
        <button @click="testApi">Test API</button>
        <p v-if="apiResponse">{{ apiResponse }}</p>
      </div>
    </main>

    <footer>
      <p>Ready for Render deployment</p>
    </footer>
  </div>
    </div>

    <!-- 项链销量排行榜页面 -->
    <NecklaceSales v-else-if="currentPage === 'necklaces'" />

    <footer class="main-footer">
      <p>Diamond Scanner v1.1 | 项链销量功能已添加</p>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'App',
  setup() {
    const currentPage = ref('diamonds')
    const dbStatus = ref('Database: Not connected')
    const diamonds = ref([])
    const apiResponse = ref('')

    const checkDatabase = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        dbStatus.value = `Database: ${data.message} | Diamonds: ${data.diamondsCount} | Necklaces: ${data.latestNecklaceMonth || 'N/A'}`
        
        // Fetch diamonds data
        const diamondsResponse = await fetch('/api/diamonds')
        diamonds.value = await diamondsResponse.json()
      } catch (error) {
        dbStatus.value = 'Database: Error connecting'
        console.error('Database error:', error)
      }
    }

    const addSampleData = async () => {
      try {
        const response = await fetch('/api/diamonds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            carat: 1.0,
            color: 'H',
            clarity: 'VS2',
            price: 6000
          })
        })
        
        if (response.ok) {
          await checkDatabase()
        }
      } catch (error) {
        console.error('Error adding data:', error)
      }
    }

    const deleteDiamond = async (id) => {
      try {
        const response = await fetch(`/api/diamonds/${id}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          await checkDatabase()
        }
      } catch (error) {
        console.error('Error deleting data:', error)
      }
    }

    const testApi = async () => {
      try {
        const response = await fetch('/api/test')
        const data = await response.json()
        apiResponse.value = `API: ${data.message}`
      } catch (error) {
        apiResponse.value = 'API Error: ' + error.message
      }
    }

    const goToNecklaces = () => {
      currentPage.value = 'necklaces'
    }

    onMounted(() => {
      checkDatabase()
    })

    return {
      currentPage,
      dbStatus,
      diamonds,
      apiResponse,
      checkDatabase,
      addSampleData,
      deleteDiamond,
      testApi,
      goToNecklaces
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app {
  min-height: 100vh;
}

/* 导航栏 */
.main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.nav-brand h1 {
  font-size: 1.5rem;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 8px;
  transition: all 0.3s;
  font-weight: 500;
}

.nav-links a:hover {
  background: rgba(255,255,255,0.2);
}

.nav-links a.active {
  background: white;
  color: #667eea;
}

/* 页面内容 */
.page-content {
  padding-bottom: 60px;
}

header {
  text-align: center;
  margin-bottom: 30px;
  padding: 40px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.subtitle {
  opacity: 0.9;
  font-size: 1.2rem;
}

.quick-entry {
  margin-top: 20px;
}

.quick-btn {
  background: white;
  color: #667eea;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s;
}

.quick-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
}

main {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.hello-section {
  text-align: center;
  margin-bottom: 30px;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 12px;
}

.hello-section h2 {
  color: #667eea;
  font-size: 2rem;
  margin-bottom: 15px;
}

.database-section, .api-test {
  margin: 25px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

h3 {
  color: #444;
  margin-bottom: 15px;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  margin: 5px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s;
}

button:hover {
  background: #5a67d8;
  transform: translateY(-2px);
}

.delete-btn {
  background: #e53e3e;
  padding: 5px 10px;
  font-size: 0.85rem;
  margin-left: 10px;
}

.delete-btn:hover {
  background: #c53030;
}

.data-section {
  margin-top: 25px;
}

.data-section ul {
  list-style: none;
}

.data-section li {
  padding: 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.api-test p {
  margin-top: 15px;
  padding: 12px;
  background: #e6f7ff;
  border-radius: 8px;
  border-left: 4px solid #1890ff;
}

footer {
  text-align: center;
  padding: 30px;
  color: #777;
  font-size: 0.9rem;
}

.main-footer {
  background: #333;
  color: white;
  padding: 20px;
  text-align: center;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .main-nav {
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }
  
  .nav-links {
    width: 100%;
    justify-content: center;
  }
  
  main {
    margin: 15px;
    padding: 20px;
  }
}
</style>
