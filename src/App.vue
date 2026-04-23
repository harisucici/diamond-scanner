<template>
  <div class="app">
    <header>
      <h1>💎 Diamond Scanner</h1>
      <p class="subtitle">A tool for scanning and managing diamond information</p>
    </header>
    
    <main>
      <div class="hello-section">
        <h2>Hello World!</h2>
        <p>Welcome to the Diamond Scanner application.</p>
        <p>This application uses Vue.js with JSON database.</p>
      </div>

      <div class="database-section">
        <h3>Database Status</h3>
        <p v-if="dbStatus">{{ dbStatus }}</p>
        <button @click="checkDatabase">Check Database</button>
        <button @click="addSampleData">Add Random Diamond</button>
        <button @click="viewData" class="view-btn">View All Data</button>
        <button @click="clearData" class="clear-btn" v-if="diamonds.length > 0">Clear All Data</button>
      </div>

      <div v-if="diamonds.length > 0" class="data-section">
        <h3>Diamond Records ({{ diamonds.length }})</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Carat</th>
              <th>Color</th>
              <th>Clarity</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="diamond in diamonds" :key="diamond.id">
              <td>{{ diamond.id }}</td>
              <td>{{ diamond.carat }} ct</td>
              <td>{{ diamond.color }}</td>
              <td>{{ diamond.clarity }}</td>
              <td>${{ diamond.price }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="api-test">
        <h3>API Test</h3>
        <button @click="testApi">Test API Connection</button>
        <p v-if="apiResponse">{{ apiResponse }}</p>
      </div>
    </main>

    <footer>
      <p>Deployed to Render - Ready for production</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const dbStatus = ref('Database: Not connected')
const diamonds = ref([])
const apiResponse = ref('')

const checkDatabase = async () => {
  try {
    const response = await fetch('/api/health')
    const data = await response.json()
    dbStatus.value = `Database: ${data.message} (${data.diamondsCount} diamonds)`
    
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
        carat: Math.random() > 0.5 ? 1.5 : 0.8,
        color: ['D', 'E', 'F', 'G'][Math.floor(Math.random() * 4)],
        clarity: ['IF', 'VVS1', 'VVS2', 'VS1'][Math.floor(Math.random() * 4)],
        price: Math.floor(Math.random() * 10000) + 1000
      })
    })
    
    if (response.ok) {
      await checkDatabase()
    }
  } catch (error) {
    console.error('Error adding data:', error)
  }
}

const viewData = async () => {
  await checkDatabase()
}

const clearData = async () => {
  if (confirm('Are you sure you want to clear all diamond data?')) {
    try {
      // Delete all diamonds one by one
      const deletePromises = diamonds.value.map(diamond => 
        fetch(`/api/diamonds/${diamond.id}`, {
          method: 'DELETE'
        })
      )
      
      await Promise.all(deletePromises)
      await checkDatabase()
      alert('All data cleared successfully!')
    } catch (error) {
      console.error('Error clearing data:', error)
      alert('Error clearing data')
    }
  }
}

const testApi = async () => {
  try {
    const response = await fetch('/api/test')
    const data = await response.json()
    apiResponse.value = `API Response: ${data.message} - Status: ${data.status}`
  } catch (error) {
    apiResponse.value = 'API Error: ' + error.message
  }
}

onMounted(() => {
  // Check database on load
  checkDatabase()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: #333;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  color: white;
  padding: 40px 20px;
  margin-bottom: 40px;
}

header h1 {
  font-size: 3rem;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
}

main {
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.1);
}

.hello-section {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 30px;
  border-bottom: 2px solid #f0f0f0;
}

.hello-section h2 {
  font-size: 2.5rem;
  color: #667eea;
  margin-bottom: 15px;
}

.hello-section p {
  font-size: 1.2rem;
  color: #666;
  margin: 10px 0;
}

.database-section, .api-test {
  margin: 30px 0;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 15px;
}

h3 {
  color: #444;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  margin: 10px 10px 10px 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

button:hover {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.view-btn {
  background: #48bb78;
}

.view-btn:hover {
  background: #38a169;
}

.clear-btn {
  background: #f56565;
}

.clear-btn:hover {
  background: #e53e3e;
}

.data-section {
  margin-top: 40px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(0,0,0,0.05);
}

th, td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  background: #667eea;
  color: white;
  font-weight: 600;
}

tr:hover {
  background: #f7fafc;
}

footer {
  text-align: center;
  color: white;
  padding: 30px;
  margin-top: 40px;
  opacity: 0.8;
}

.api-test p {
  margin-top: 15px;
  padding: 10px;
  background: #e6f7ff;
  border-radius: 8px;
  border-left: 4px solid #1890ff;
}
</style>