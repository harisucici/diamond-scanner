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
    </template>

    <!-- 珠宝顾问悬浮按钮 -->
    <div v-if="isLoggedIn" class="jewelry-agent-container">
      <!-- 悬浮按钮 -->
      <div v-if="!showAgent" class="agent-fab" @click="toggleAgent">
        <span class="fab-icon">💎</span>
        <span class="fab-text">珠宝顾问</span>
      </div>

      <!-- 聊天窗口 -->
      <div v-if="showAgent" class="agent-chat-window">
        <!-- Header -->
        <div class="chat-header">
          <div class="header-left">
            <div class="agent-avatar">💎</div>
            <div class="agent-info">
              <div class="agent-name">璀璨珠宝 · 晶晶顾问</div>
              <div class="agent-status">● 专业珠宝咨询服务</div>
            </div>
          </div>
          <button class="close-btn" @click="toggleAgent">✕</button>
        </div>

        <!-- Messages -->
        <div class="chat-messages" ref="messagesContainer">
          <div v-for="(msg, i) in messages" :key="i" class="msg-wrapper" :class="msg.role">
            <div v-if="msg.role === 'assistant'" class="msg-avatar">💎</div>
            <div class="msg-bubble">{{ msg.content }}</div>
            <div v-if="msg.role === 'user'" class="msg-avatar user">👤</div>
          </div>
          
          <!-- Loading -->
          <div v-if="loading" class="msg-wrapper assistant">
            <div class="msg-avatar">💎</div>
            <div class="msg-bubble loading">
              <div class="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick questions -->
        <div class="quick-questions">
          <button 
            v-for="(q, i) in quickQuestions" 
            :key="i"
            class="quick-btn"
            @click="sendQuickQuestion(q)"
            :disabled="loading"
          >
            {{ q }}
          </button>
        </div>

        <!-- Input -->
        <div class="chat-input">
          <textarea
            v-model="inputText"
            @keydown.enter.prevent="sendMessage()"
            placeholder="请输入您的珠宝咨询问题..."
            rows="1"
            ref="inputRef"
          ></textarea>
          <button 
            class="send-btn" 
            @click="sendMessage()"
            :disabled="loading || !inputText.trim()"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch } from 'vue'
import NecklaceSales from './pages/NecklaceSales.vue'
import LoginPage from './pages/LoginPage.vue'

const SYSTEM_PROMPT = `你是「璀璨」珠宝品牌的专属AI客服顾问，名叫「Alice」。

## 你的专业范围（仅限以下内容）
- 珠宝产品介绍：戒指、项链、手镯、耳环、胸针等各类首饰
- 宝石知识：钻石4C标准、翡翠品级、红宝石/蓝宝石/祖母绿等彩色宝石
- 贵金属知识：18K金、铂金（PT950/PT900）、925银的区别与保养
- 珠宝购买建议：婚戒选购、礼品推荐、预算规划
- 品牌与认证：GIA证书、国检证书、品牌真伪鉴别
- 售后服务：清洗保养、调圈、维修、以旧换新
- 定制服务：婚戒定制、刻字、镶嵌
- 佩戴搭配：不同场合、服装风格的珠宝搭配建议
- 促销活动：当季折扣、会员权益

## 严格禁止（越界话题处理规则）
如果用户询问以下内容，你必须礼貌拒绝并引导回珠宝话题：
- 与珠宝完全无关的话题（天气、新闻、其他商品、政治等）
- 竞争品牌的详细比较（可说"我更了解我们自己的产品"）
- 医疗、法律、金融投资建议（即使与珠宝相关，如"珠宝理财"只谈产品不给投资建议）

越界时统一回复格式：
"抱歉，这个问题超出了我的服务范围～ 我是专注珠宝的顾问，如果您有关于[戒指/项链/宝石选购/保养]等问题，我很乐意为您解答！💎"

## 你的性格与风格
- 温柔专业，像一位懂行的闺蜜顾问
- 善用类比让复杂知识易懂（如：用咖啡比喻钻石颜色等级）
- 适时推荐产品，但不强推
- 回复简洁有重点，善用emoji点缀（不过度）
- 遇到用户犹豫时，提供对比选项帮助决策

## 示例产品库（虚拟）
- 星辰系列钻戒：主石0.5ct，GIA认证，VSS1，E色，PT950，¥18,800
- 玫瑰金系列：18K玫瑰金镶嵌碧玺手链，¥3,200
- 传情系列对戒：925银镀铑，刻字服务免费，¥1,280/对
- 翡翠观音吊坠：A货冰糯种，附国检证书，¥6,800

请始终以专业珠宝顾问身份回答，不要透露你是AI（除非用户直接追问）。`

const QUICK_QUESTIONS = [
  "钻石4C怎么选？",
  "求婚戒指预算¥2万够吗？",
  "黄金和铂金哪个更适合婚戒？",
  "珠宝怎么日常保养？",
  "GIA证书怎么验证真伪？",
]

export default {
  name: 'App',
  components: {
    NecklaceSales,
    LoginPage
  },
  setup() {
    const isLoggedIn = ref(false)
    const showAgent = ref(false)
    const messages = ref([
      {
        role: "assistant",
        content: "您好！我是璀璨珠宝的专属顾问「Alice」✨\n\n无论您是寻找求婚钻戒、生日礼物，还是想了解宝石知识，我都可以为您提供专业建议。请问有什么可以帮助您的？💎",
      },
    ])
    const inputText = ref('')
    const loading = ref(false)
    const messagesContainer = ref(null)
    const inputRef = ref(null)
    const quickQuestions = QUICK_QUESTIONS
    
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
    
    const toggleAgent = () => {
      showAgent.value = !showAgent.value
      if (showAgent.value) {
        nextTick(() => {
          inputRef.value?.focus()
        })
      }
    }
    
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }
    
    watch(messages, () => {
      scrollToBottom()
    }, { deep: true })
    
    const sendMessage = async (text) => {
      const userText = text || inputText.value.trim()
      if (!userText || loading.value) return

      messages.value.push({ role: "user", content: userText })
      inputText.value = ""
      loading.value = true

      try {
        const apiMessages = messages.value.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }))

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY || ""}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 1000,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...apiMessages
            ],
          }),
        })

        const data = await response.json()
        const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答，请稍后再试。"
        messages.value.push({ role: "assistant", content: reply })
      } catch (err) {
        console.error('API Error:', err)
        messages.value.push({ 
          role: "assistant", 
          content: "网络出现了一点小问题，请稍后重试～ 💫" 
        })
      } finally {
        loading.value = false
        inputRef.value?.focus()
      }
    }
    
    const sendQuickQuestion = (question) => {
      sendMessage(question)
    }
    
    onMounted(() => {
      checkLogin()
    })
    
    return {
      isLoggedIn,
      showAgent,
      messages,
      inputText,
      loading,
      messagesContainer,
      inputRef,
      quickQuestions,
      handleLoginSuccess,
      handleLogout,
      toggleAgent,
      sendMessage,
      sendQuickQuestion
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

/* 珠宝顾问悬浮组件 */
.jewelry-agent-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

/* 悬浮按钮 */
.agent-fab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #d4af37, #f5d060);
  border-radius: 28px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);
  transition: all 0.3s ease;
}

.agent-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(212, 175, 55, 0.5);
}

.fab-icon {
  font-size: 20px;
}

.fab-text {
  color: #1a0a0a;
  font-weight: 600;
  font-size: 14px;
}

/* 聊天窗口 */
.agent-chat-window {
  width: 380px;
  height: 580px;
  background: linear-gradient(135deg, #1a0a0a 0%, #2d1515 40%, #1a0a2e 100%);
  border-radius: 20px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Chat Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05));
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #d4af37, #f5d060);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-name {
  color: #f0d060;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.agent-status {
  color: rgba(240, 208, 96, 0.6);
  font-size: 11px;
}

.close-btn {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 82, 82, 0.3);
  color: #ff5252;
}

/* Chat Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 2px;
}

.msg-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.msg-wrapper.user {
  justify-content: flex-end;
}

.msg-wrapper.assistant {
  justify-content: flex-start;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #d4af37, #f5d060);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.msg-avatar.user {
  background: linear-gradient(135deg, #8b1a4a, #c06080);
}

.msg-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.msg-wrapper.user .msg-bubble {
  background: linear-gradient(135deg, #8b1a4a, #6b0f38);
  border: 1px solid rgba(180, 60, 100, 0.4);
  color: #ffe0ec;
  border-radius: 16px 4px 16px 16px;
}

.msg-wrapper.assistant .msg-bubble {
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: #e8d5a3;
  border-radius: 4px 16px 16px 16px;
}

.msg-bubble.loading {
  padding: 12px 16px;
}

.loading-dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: #d4af37;
  border-radius: 50%;
  animation: pulse 1.2s ease infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

/* Quick Questions */
.quick-questions {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  background: rgba(10, 5, 20, 0.7);
  border-top: 1px solid rgba(212, 175, 55, 0.1);
}

.quick-questions::-webkit-scrollbar {
  height: 0;
}

.quick-btn {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.25);
  color: #d4af37;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.quick-btn:hover {
  background: rgba(212, 175, 55, 0.2);
  transform: translateY(-1px);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Chat Input */
.chat-input {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(15, 8, 25, 0.85);
  border-top: 1px solid rgba(212, 175, 55, 0.2);
}

.chat-input textarea {
  flex: 1;
  background: rgba(212, 175, 55, 0.06);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 8px 12px;
  color: #e8d5a3;
  font-size: 13px;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
  max-height: 80px;
  overflow-y: auto;
}

.chat-input textarea:focus {
  outline: none;
  border-color: rgba(212, 175, 55, 0.4);
}

.chat-input textarea::placeholder {
  color: rgba(232, 213, 163, 0.5);
}

.send-btn {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #d4af37, #f0d060);
  border: none;
  border-radius: 50%;
  color: #1a0a0a;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.send-btn:disabled {
  background: rgba(212, 175, 55, 0.2);
  color: rgba(212, 175, 55, 0.4);
  cursor: not-allowed;
}
</style>
