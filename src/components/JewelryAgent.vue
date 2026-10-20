<template>
  <div class="jewelry-agent">
    <!-- 浮动按钮 -->
    <button
      v-if="!isOpen"
      class="fab-button"
      @click="toggleAgent"
      :style="{ '--delay': '0s' }"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- 聊天面板 -->
    <div v-if="isOpen" class="chat-panel">
      <!-- 头部 -->
      <div class="chat-header">
        <div class="header-left">
          <div class="agent-avatar">A</div>
          <div class="header-info">
            <h3>Alice 珠宝顾问</h3>
            <p>专业咨询服务</p>
          </div>
        </div>
        <button class="close-button" @click="toggleAgent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- 消息区域 -->
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message-wrapper"
          :class="{ 'user-message': message.role === 'user', 'assistant-message': message.role === 'assistant' }"
        >
          <div v-if="message.role === 'assistant'" class="message-avatar">A</div>
          <div class="message-bubble">
            <div class="message-content">{{ message.content }}</div>
            <div v-if="message.products && message.products.length > 0" class="products-grid">
              <div
                v-for="(product, pIndex) in message.products"
                :key="pIndex"
                class="product-card"
                @click="openProduct(product)"
              >
                <div class="product-image">
                  <img v-if="product.image" :src="product.image" :alt="product.name" />
                  <div v-else class="product-placeholder"></div>
                </div>
                <div class="product-info">
                  <div class="product-name">{{ product.name }}</div>
                  <div class="product-price">{{ product.price }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading 状态 -->
        <div v-if="isLoading" class="message-wrapper assistant-message">
          <div class="message-avatar">A</div>
          <div class="message-bubble">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷问题 -->
      <div class="quick-questions">
        <button
          v-for="(question, index) in quickQuestions"
          :key="index"
          class="quick-button"
          @click="sendQuickQuestion(question)"
          :disabled="isLoading"
        >
          {{ question }}
        </button>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <input
          v-model="userInput"
          @keyup.enter="sendMessage"
          :disabled="isLoading"
          placeholder="输入您的问题..."
          class="message-input"
        />
        <button
          @click="sendMessage"
          :disabled="isLoading || !userInput.trim()"
          class="send-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'

export default {
  name: 'JewelryAgent',
  setup() {
    const isOpen = ref(false)
    const isLoading = ref(false)
    const userInput = ref('')
    const messagesContainer = ref(null)

    const messages = ref([
      {
        role: 'assistant',
        content: '您好！我是 Alice 珠宝顾问。我可以帮您解答关于珠宝选购、保养、搭配等问题。请问有什么可以帮您的？'
      }
    ])

    const quickQuestions = ref([
      '如何选择求婚钻戒',
      '钻石 4C 标准是什么',
      '如何保养珍珠项链'
    ])

    const toggleAgent = () => {
      isOpen.value = !isOpen.value
    }

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    const sendMessage = async () => {
      if (!userInput.value.trim() || isLoading.value) return

      const userMessage = userInput.value.trim()
      userInput.value = ''
      messages.value.push({ role: 'user', content: userMessage })
      scrollToBottom()

      isLoading.value = true

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage })
        })

        const data = await response.json()

        messages.value.push({
          role: 'assistant',
          content: data.reply || '抱歉，我暂时无法回答您的问题。',
          products: data.products || []
        })
      } catch (error) {
        console.error('Chat error:', error)
        messages.value.push({
          role: 'assistant',
          content: '网络错误，请稍后重试。'
        })
      } finally {
        isLoading.value = false
        scrollToBottom()
      }
    }

    const sendQuickQuestion = (question) => {
      userInput.value = question
      sendMessage()
    }

    const openProduct = (product) => {
      if (product.url) {
        window.open(product.url, '_blank')
      }
    }

    onMounted(() => {
      // 组件挂载后的初始化
    })

    return {
      isOpen,
      isLoading,
      userInput,
      messagesContainer,
      messages,
      quickQuestions,
      toggleAgent,
      sendMessage,
      sendQuickQuestion,
      openProduct
    }
  }
}
</script>

<style scoped>
.jewelry-agent {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

/* 浮动按钮 */
.fab-button {
  width: 56px;
  height: 56px;
  background: #d4a574;
  border: none;
  border-radius: 50%;
  color: #0a0a0a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(212, 165, 116, 0.3);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
}

.fab-button:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 24px rgba(212, 165, 116, 0.4);
}

.fab-button:active {
  transform: scale(0.95);
}

/* 聊天面板 */
.chat-panel {
  width: 384px;
  height: 600px;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  animation: panel-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-avatar {
  width: 40px;
  height: 40px;
  background: #d4a574;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a0a0a;
  font-weight: 600;
  font-size: 18px;
}

.header-info h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.header-info p {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.close-button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.close-button:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 消息区域 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.message-wrapper {
  display: flex;
  gap: 10px;
  animation: message-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  justify-content: flex-end;
}

.assistant-message {
  justify-content: flex-start;
}

.message-avatar {
  width: 28px;
  height: 28px;
  background: #d4a574;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a0a0a;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.user-message .message-bubble {
  background: #d4a574;
  color: #0a0a0a;
  border-bottom-right-radius: 4px;
}

.assistant-message .message-bubble {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-bottom-left-radius: 4px;
}

.message-content {
  white-space: pre-wrap;
}

/* 产品推荐 */
.products-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.product-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.product-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(212, 165, 116, 0.3);
}

.product-image {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.2), rgba(212, 165, 116, 0.05));
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-price {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #d4a574;
}

/* Loading 动画 */
.loading-dots {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: #d4a574;
  border-radius: 50%;
  animation: loading-bounce 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.16s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes loading-bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 快捷问题 */
.quick-questions {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.3);
}

.quick-questions::-webkit-scrollbar {
  height: 0;
}

.quick-button {
  padding: 6px 12px;
  background: rgba(212, 165, 116, 0.1);
  border: 1px solid rgba(212, 165, 116, 0.2);
  border-radius: 16px;
  color: #d4a574;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, border-color 0.2s;
}

.quick-button:hover:not(:disabled) {
  background: rgba(212, 165, 116, 0.2);
  border-color: rgba(212, 165, 116, 0.4);
}

.quick-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 输入区域 */
.input-area {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.message-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.message-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.message-input:focus {
  border-color: #d4a574;
}

.message-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-button {
  width: 40px;
  height: 40px;
  background: #d4a574;
  border: none;
  border-radius: 8px;
  color: #0a0a0a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
}

.send-button:hover:not(:disabled) {
  background: #c49564;
}

.send-button:active:not(:disabled) {
  transform: scale(0.95);
}

.send-button:disabled {
  background: rgba(212, 165, 116, 0.3);
  color: rgba(10, 10, 10, 0.3);
  cursor: not-allowed;
}
</style>
