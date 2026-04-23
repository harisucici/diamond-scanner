<template>
  <div class="app">
    <h1>💎 Diamond Scanner</h1>
    <p class="subtitle">Vue.js application with JSON database</p>
    
    <div class="hello">
      <h2>Hello World!</h2>
      <p>This is a simple Vue.js application.</p>
    </div>
    
    <div class="controls">
      <button @click="testApi">Test API</button>
      <button @click="getData">Get Data</button>
    </div>
    
    <div v-if="message" class="message">
      {{ message }}
    </div>
    
    <div v-if="data" class="data">
      <pre>{{ JSON.stringify(data, null, 2) }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      message: '',
      data: null
    }
  },
  methods: {
    async testApi() {
      try {
        const response = await fetch('/api/test')
        const result = await response.json()
        this.message = `API Status: ${result.status}`
        this.data = result
      } catch (error) {
        this.message = `Error: ${error.message}`
      }
    },
    
    async getData() {
      try {
        const response = await fetch('/api/health')
        const result = await response.json()
        this.message = `Database: ${result.message} (${result.diamondsCount} diamonds)`
        this.data = result
      } catch (error) {
        this.message = `Error: ${error.message}`
      }
    }
  },
  mounted() {
    this.testApi()
  }
}
</script>

<style>
.app {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #2c3e50;
  text-align: center;
}

.subtitle {
  color: #7f8c8d;
  text-align: center;
  margin-bottom: 30px;
}

.hello {
  text-align: center;
  margin: 30px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.controls {
  text-align: center;
  margin: 20px 0;
}

button {
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  margin: 0 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

button:hover {
  background: #2980b9;
}

.message {
  margin: 20px 0;
  padding: 15px;
  background: #e8f4fc;
  border-radius: 5px;
  text-align: center;
}

.data {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 5px;
  overflow: auto;
}
</style>