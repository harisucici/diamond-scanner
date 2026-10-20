<template>
  <div class="login-page">
    <!-- Left: Brand Panel -->
    <div class="brand-panel">
      <div class="brand-content">
        <div class="brand-mark"></div>
        <h1 class="brand-title">Diamond<br />Scanner</h1>
        <p class="brand-subtitle">日本配饰市场数据洞察平台。深度分析各品类销量趋势，发现高潜力商品机会。</p>
        <div class="brand-decoration">
          <span class="deco-line deco-line-1"></span>
          <span class="deco-line deco-line-2"></span>
        </div>
      </div>
    </div>

    <!-- Right: Login Form -->
    <div class="form-panel">
      <div class="form-wrapper" :class="{ visible: mounted }">
        <div class="form-header">
          <h2>登录账户</h2>
          <p>输入您的凭据以访问数据面板</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">用户名</label>
            <input
              id="username"
              type="text"
              v-model="username"
              placeholder="请输入用户名"
              required
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">密码</label>
            <input
              id="password"
              type="password"
              v-model="password"
              placeholder="请输入密码"
              required
              autocomplete="current-password"
            />
          </div>

          <p v-if="error" class="error-text">{{ error }}</p>

          <button type="submit" class="login-btn" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

const CORRECT_HASH = '87ad42f21943ac119d6893ecf0021f0365446acbb7cafda7301bd942c14ce8f4'

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default {
  name: 'LoginPage',
  emits: ['login-success'],
  setup(props, { emit }) {
    const username = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const mounted = ref(false)

    onMounted(() => {
      requestAnimationFrame(() => {
        mounted.value = true
      })
    })

    const handleLogin = async () => {
      error.value = ''
      loading.value = true

      try {
        const hash = await sha256(password.value)

        if (username.value === 'Alice An' && hash === CORRECT_HASH) {
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('loginTime', Date.now().toString())
          emit('login-success')
        } else {
          error.value = '用户名或密码错误'
          loading.value = false
        }
      } catch (e) {
        error.value = '登录过程出错'
        loading.value = false
      }
    }

    return {
      username,
      password,
      error,
      loading,
      mounted,
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: #0a0a0a;
}

/* ── Left: Brand Panel ── */
.brand-panel {
  width: 50%;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  position: relative;
  overflow: hidden;
}

.brand-content {
  position: relative;
  z-index: 1;
}

.brand-mark {
  width: 40px;
  height: 2px;
  background: #d4a574;
  margin-bottom: 48px;
}

.brand-title {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1.05;
  color: #ffffff;
  margin: 0 0 24px 0;
}

.brand-subtitle {
  font-size: 1rem;
  line-height: 1.7;
  color: #9ca3af;
  max-width: 400px;
  margin: 0;
}

.brand-decoration {
  position: absolute;
  bottom: -120px;
  right: -80px;
  pointer-events: none;
}

.deco-line {
  position: absolute;
  background: rgba(212, 165, 116, 0.08);
}

.deco-line-1 {
  width: 300px;
  height: 1px;
  transform: rotate(-35deg);
}

.deco-line-2 {
  width: 200px;
  height: 1px;
  transform: rotate(-35deg) translate(40px, 30px);
}

/* ── Right: Form Panel ── */
.form-panel {
  width: 50%;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.form-wrapper {
  width: 100%;
  max-width: 400px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.form-wrapper.visible {
  opacity: 1;
  transform: translateY(0);
}

.form-header {
  margin-bottom: 40px;
}

.form-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 8px 0;
}

.form-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.login-form {
  width: 100%;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #9ca3af;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.9375rem;
  color: #ffffff;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.form-group input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.form-group input:focus {
  border-color: #d4a574;
  box-shadow: 0 0 0 2px rgba(212, 165, 116, 0.2);
}

.error-text {
  color: #ef4444;
  font-size: 0.8125rem;
  margin: 0 0 16px 0;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background: #d4a574;
  color: #000000;
  border: none;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  background: #c49564;
}

.login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Responsive: stack on small screens ── */
@media (max-width: 768px) {
  .login-page {
    flex-direction: column;
  }

  .brand-panel,
  .form-panel {
    width: 100%;
    padding: 48px 32px;
  }

  .brand-panel {
    min-height: auto;
  }

  .brand-title {
    font-size: 2.25rem;
  }

  .brand-decoration {
    display: none;
  }
}
</style>
