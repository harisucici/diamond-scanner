<template>
  <div class="jewelry-agent-container">
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
            <div class="agent-name">Alice · An顾问</div>
            <div class="agent-status">● 专业珠宝咨询服务</div>
          </div>
        </div>
        <button class="close-btn" @click="toggleAgent">✕</button>
      </div>

      <!-- Messages -->
      <div class="chat-messages" ref="messagesContainer">
        <div v-for="(msg, i) in messages" :key="i" class="msg-wrapper" :class="msg.role">
          <div v-if="msg.role === 'assistant'" class="msg-avatar">💎</div>
          <div class="msg-content">
            <div class="msg-bubble">{{ msg.content }}</div>
            <div v-if="msg.products && msg.products.length > 0" class="products-container">
              <div class="products-title">为您推荐以下产品（点击查看详情）</div>
              <div class="products-grid">
                <div v-for="(product, pi) in msg.products" :key="pi" class="product-card" @click="openProduct(product)">
                  <div class="product-image" v-if="product.image">
                    <img :src="product.image" :alt="product.productName" @error="handleImageError" />
                  </div>
                  <div class="product-image product-placeholder" v-else>
                    <span>💎</span>
                  </div>
                  <div class="product-info">
                    <div class="product-brand">{{ product.brand }}</div>
                    <div class="product-name">{{ product.productName }}</div>
                    <div class="product-price">{{ product.price }}</div>
                    <div class="product-source">来源: {{ product.source }}</div>
                    <div class="product-link" v-if="product.url">点击查看详情 →</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
</template>

<script>
import { ref, onMounted, nextTick, watch } from 'vue'
import { chatService } from '../services/chatService'
import { QUICK_QUESTIONS } from '../config/chat.js'

export default {
  name: 'JewelryAgent',
  setup() {
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

      inputText.value = ""
      loading.value = true

      try {
        const updatedMessages = await chatService.sendMessage(messages.value, userText)
        messages.value = updatedMessages
      } catch (err) {
        console.error('Send Message Error:', err)
      } finally {
        loading.value = false
        inputRef.value?.focus()
      }
    }
    
    const sendQuickQuestion = (question) => {
      sendMessage(question)
    }
    
    const openProduct = (product) => {
      if (product.url) {
        window.open(product.url, '_blank')
      }
    }
    
    const handleImageError = (e) => {
      e.target.style.display = 'none'
    }
    
    onMounted(() => {
      // 组件挂载时不需要检查登录状态，这个逻辑在父组件处理
    })
    
    return {
      showAgent,
      messages,
      inputText,
      loading,
      messagesContainer,
      inputRef,
      quickQuestions,
      toggleAgent,
      sendMessage,
      sendQuickQuestion,
      openProduct,
      handleImageError
    }
  }
}
</script>

<style scoped>
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

.msg-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 75%;
}

.msg-wrapper.user .msg-content {
  align-items: flex-end;
}

.msg-wrapper.assistant .msg-content {
  align-items: flex-start;
}

.msg-wrapper.user .msg-bubble {
  background: linear-gradient(135deg, #8b1a4a, #6b0f38);
  border: 1px solid rgba(180, 60, 100, 0.4);
  color: #ffe0ec;
  border-radius: 16px 4px 16px 16px;
  max-width: 100%;
}

.msg-wrapper.assistant .msg-bubble {
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: #e8d5a3;
  border-radius: 4px 16px 16px 16px;
  max-width: 100%;
}

.products-container {
  background: rgba(10, 5, 20, 0.9);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  padding: 12px;
  margin-top: 4px;
}

.products-title {
  color: #d4af37;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.products-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-card {
  display: flex;
  gap: 10px;
  background: rgba(212, 175, 55, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.product-card:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: rgba(212, 175, 55, 0.4);
  transform: translateX(2px);
}

.product-image {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(212, 175, 55, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-placeholder {
  font-size: 20px;
}

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-brand {
  color: #d4af37;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.product-name {
  color: #e8d5a3;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-price {
  color: #f0d060;
  font-size: 12px;
  font-weight: 600;
}

.product-source {
  color: rgba(232, 213, 163, 0.6);
  font-size: 9px;
}

.product-link {
  color: #d4af37;
  font-size: 10px;
  margin-top: 2px;
  font-weight: 500;
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