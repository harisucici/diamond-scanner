<template>
  <div class="app">
    <nav class="main-nav">
      <div class="nav-brand">
        <h1>💍 日本配饰销量排行</h1>
      </div>
    </nav>

    <!-- 配饰销量排行榜页面 -->
    <NecklaceSales />

    <footer class="main-footer">
      <p>日本配饰销量排行 v1.0</p>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import NecklaceSales from './pages/NecklaceSales.vue'

export default {
  name: 'App',
  components: {
    NecklaceSales
  },
  setup() {
    // 配饰销量页面
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app {
  min-height: 100vh;
  padding-bottom: 60px;
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
  font-size: 1.3rem;
}

.nav-links {
  display: flex;
  gap: 10px;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.3s;
  font-weight: 500;
  font-size: 0.95rem;
}

.nav-links a:hover {
  background: rgba(255,255,255,0.2);
}

.nav-links a.active {
  background: white;
  color: #667eea;
}

/* 钻石管理页面样式 */
.diamond-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  padding: 30px;
  background: white;
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.page-header h1 {
  color: #667eea;
  font-size: 2rem;
  margin-bottom: 10px;
}

.subtitle {
  color: #777;
}

main {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.status-section, .api-section {
  margin-bottom: 25px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

h3 {
  color: #444;
  margin-bottom: 15px;
}

.btn-group {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
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
  padding: 6px 12px;
  font-size: 0.85rem;
}

.delete-btn:hover {
  background: #c53030;
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

.api-result {
  margin-top: 15px;
  padding: 12px;
  background: #e6fffa;
  border-radius: 8px;
  border-left: 4px solid #38b2ac;
}

/* 页脚 */
.main-footer {
  text-align: center;
  padding: 15px;
  background: #333;
  color: #aaa;
  font-size: 0.85rem;
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
  
  .diamond-page {
    padding: 15px;
  }
  
  main {
    padding: 20px;
  }
}
</style>
