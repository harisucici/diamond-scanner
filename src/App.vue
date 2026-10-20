<template>
  <div class="app">
    <!-- 登录页 -->
    <LoginPage v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
    
    <!-- 主页面 -->
    <template v-else>
      <nav class="main-nav">
        <div class="nav-brand">
          <span class="brand-mark">◆</span>
          <h1>Diamond Scanner</h1>
        </div>
        <div class="nav-tabs">
          <button 
            :class="['nav-tab', { active: currentPage === 'sales' }]" 
            @click="currentPage = 'sales'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>配饰排行</span>
          </button>
          <button 
            :class="['nav-tab', { active: currentPage === 'cad' }]" 
            @click="currentPage = 'cad'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>CAD 分析</span>
          </button>
        </div>
        <button class="logout-btn" @click="handleLogout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>退出</span>
        </button>
      </nav>

      <main class="main-content">
        <!-- 配饰销量排行榜页面 -->
        <NecklaceSales v-if="currentPage === 'sales'" />

        <!-- CAD 设计与生产风险分析 -->
        <CADAnalysis v-if="currentPage === 'cad'" />
      </main>

      <footer class="main-footer">
        <p>Diamond Scanner v1.1</p>
      </footer>
      
      <!-- 珠宝顾问组件 -->
      <JewelryAgent />
    </template>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import NecklaceSales from './pages/NecklaceSales.vue'
import CADAnalysis from './pages/CADAnalysis.vue'
import LoginPage from './pages/LoginPage.vue'
import JewelryAgent from './components/JewelryAgent.vue'

export default {
  name: 'App',
  components: {
    NecklaceSales,
    CADAnalysis,
    LoginPage,
    JewelryAgent
  },
  setup() {
    const isLoggedIn = ref(false)
    const currentPage = ref('sales')
    
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
      currentPage,
      handleLoginSuccess,
      handleLogout
    }
  }
}
</script>

<style>
/* ── Design Tokens ── */
:root {
  --bg-base: #0a0a0a;
  --bg-surface: #1a1a1a;
  --bg-elevated: #242424;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);
  --text-primary: #fafafa;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-tertiary: rgba(255, 255, 255, 0.3);
  --accent-gold: #d4a574;
  --accent-gold-dim: rgba(212, 165, 116, 0.15);
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-card: 0 20px 40px -15px rgba(0, 0, 0, 0.5);

  --font-heading: 'Geist', 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

/* ── Reset ── */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: var(--font-body);
  background: var(--bg-base);
  color: var(--text-primary);
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100dvh;
}

.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* ── Navigation ── */
.main-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 56px;
  background: rgba(10, 10, 10, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  color: var(--accent-gold);
  font-size: 1.1rem;
  line-height: 1;
}

.nav-brand h1 {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.nav-tabs {
  display: flex;
  gap: 4px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-tab:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.nav-tab.active {
  color: var(--accent-gold);
  background: var(--accent-gold-dim);
  border-color: rgba(212, 165, 116, 0.2);
}

.nav-tab svg {
  flex-shrink: 0;
  opacity: 0.85;
}

.nav-tab.active svg {
  opacity: 1;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.06);
}

/* ── Main Content ── */
.main-content {
  flex: 1;
  padding: 24px;
}

/* ── Footer ── */
.main-footer {
  text-align: center;
  padding: 20px 24px;
  color: var(--text-tertiary);
  font-size: 0.8rem;
  border-top: 1px solid var(--border-subtle);
}
</style>
