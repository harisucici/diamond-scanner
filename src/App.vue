<template>
  <div class="app">
    <!-- 登录页 -->
    <LoginPage v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
    
    <!-- 主页面 -->
    <template v-else>
      <nav class="main-nav">
        <div class="nav-brand">
          <h1>💍 日本配饰销量排行</h1>
        </div>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </nav>

      <!-- 配饰销量排行榜页面 -->
      <NecklaceSales />

      <footer class="main-footer">
        <p>日本配饰销量排行 v1.0</p>
      </footer>
      
      <!-- 珠宝顾问组件 -->
      <JewelryAgent />
    </template>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import NecklaceSales from './pages/NecklaceSales.vue'
import LoginPage from './pages/LoginPage.vue'
import JewelryAgent from './components/JewelryAgent.vue'

export default {
  name: 'App',
  components: {
    NecklaceSales,
    LoginPage,
    JewelryAgent
  },
  setup() {
    const isLoggedIn = ref(false)
    
    const checkLogin = () => {
      const loggedIn = localStorage.getItem('isLoggedIn')
      if (loggedIn) {
        const loginTime = parseInt(localStorage.getItem('loginTime') || '0')
        const now = Date.now()
        const oneDay = 24 * 60 * 60 * 1000
        
        if (now - loginTime < oneDay) {
          isLoggedIn.value = true
        } else {
          localStorage.removeItem('isLoggedIn')
          localStorage.removeItem('loginTime')
        }
      }
    }
    
    const handleLoginSuccess = () => {
      isLoggedIn.value = true
    }
    
    const handleLogout = () => {
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('loginTime')
      isLoggedIn.value = false
    }
    
    onMounted(() => {
      checkLogin()
    })
    
    return {
      isLoggedIn,
      handleLoginSuccess,
      handleLogout
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

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  color: #fff;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

.app {
  min-height: 100vh;
}

/* 导航栏 */
.main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-brand h1 {
  font-size: 1.4rem;
  font-weight: 700;
  background: linear-gradient(135deg, #00d4ff 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logout-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(255, 82, 82, 0.2);
  border-color: rgba(255, 82, 82, 0.4);
  color: #ff5252;
}

/* 页脚 */
.main-footer {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
}

</style>
