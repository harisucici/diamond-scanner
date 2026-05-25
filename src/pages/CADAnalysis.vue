<template>
  <div class="cad-analysis">
    <!-- 页面标题 -->
    <div class="page-title">
      <h1>🔬 CAD 图纸 AI 分析</h1>
      <p class="subtitle">上传 CAD 图纸，AI 自动识别风险并给出优化建议</p>
    </div>

    <!-- 图片上传区域 -->
    <div class="upload-section">
      <div
        class="upload-zone"
        :class="{ 'drag-over': isDragOver, 'has-image': previewUrl }"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        @click="!previewUrl && triggerFileInput()"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          @change="onFileSelect"
          style="display: none"
        />

        <template v-if="!previewUrl">
          <div class="upload-icon">📁</div>
          <p class="upload-text">拖拽图片到这里，或 <span class="upload-link">点击选择文件</span></p>
          <p class="upload-hint">支持 JPG / PNG / WebP，最大 10MB</p>
        </template>

        <template v-else>
          <img :src="previewUrl" alt="预览" class="preview-image" />
          <div class="preview-overlay">
            <button class="btn btn-sm btn-replace" @click.stop="replaceImage">🔄 替换图片</button>
            <button class="btn btn-sm btn-analyze" @click.stop="startAnalysis" :disabled="analyzing">
              {{ analyzing ? '分析中...' : '🚀 开始分析' }}
            </button>
          </div>
        </template>
      </div>

      <div v-if="uploadError" class="error-message">
        ❌ {{ uploadError }}
      </div>
    </div>

    <!-- 分析中状态 -->
    <div v-if="analyzing" class="analyzing-section">
      <div class="analyzing-card">
        <div class="analyzing-spinner"></div>
        <p class="analyzing-text">AI 正在分析图纸，请稍候...</p>
        <div class="analyzing-steps">
          <div :class="['step', analysisStep >= 1 ? 'done' : '']">
            <span class="step-icon">{{ analysisStep > 1 ? '✅' : analysisStep === 1 ? '⏳' : '⬜' }}</span>
            <span>图像识别</span>
          </div>
          <div :class="['step', analysisStep >= 2 ? 'done' : '']">
            <span class="step-icon">{{ analysisStep > 2 ? '✅' : analysisStep === 2 ? '⏳' : '⬜' }}</span>
            <span>风险评估</span>
          </div>
          <div :class="['step', analysisStep >= 3 ? 'done' : '']">
            <span class="step-icon">{{ analysisStep > 3 ? '✅' : analysisStep === 3 ? '⏳' : '⬜' }}</span>
            <span>生成报告</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分析结果 -->
    <div v-if="analysisResult && !analyzing" class="results-section">
      <!-- 标注图片 -->
      <div class="annotated-image-section">
        <h2>📐 标注图纸</h2>
        <div class="image-container">
          <img :src="annotatedImageUrl" alt="AI 标注结果" class="annotated-image" />
        </div>
      </div>

      <!-- Markdown 分析结果 -->
      <div class="analysis-content">
        <h2>📋 分析报告</h2>
        <div class="markdown-body" v-html="renderedMarkdown"></div>
      </div>

      <!-- 学习反馈区 -->
      <div class="feedback-section">
        <h2>🎓 学习反馈</h2>
        <p class="feedback-hint">AI 分析可能存在偏差，请帮助改进模型</p>

        <div v-if="riskItems.length === 0" class="feedback-empty">
          <p>未识别到可反馈的风险项</p>
        </div>

        <div v-for="(risk, index) in riskItems" :key="index" class="feedback-card">
          <div class="feedback-header">
            <span class="risk-level" :class="risk.level">{{ risk.levelText }}</span>
            <span class="risk-title">{{ risk.title }}</span>
          </div>
          <p class="risk-desc">{{ risk.description }}</p>
          <div class="feedback-actions">
            <button
              v-if="!risk.submitted"
              class="btn btn-agree"
              :class="{ submitting: risk.submitting }"
              :disabled="risk.submitting"
              @click="setFeedback(index, 'agree')"
            >
              <span v-if="risk.submitting">⏳</span>
              <span v-else>✅ 同意分析</span>
            </button>
            <button
              v-if="!risk.submitted && risk.feedback !== 'correct'"
              class="btn btn-correct"
              @click="setFeedback(index, 'correct')"
            >
              ✏️ 需要修正
            </button>
            <template v-if="risk.feedback === 'correct' && !risk.submitted">
              <div class="correction-input">
                <textarea
                  v-model="risk.correction"
                  placeholder="请输入正确的分析结果..."
                  rows="2"
                ></textarea>
                <button
                  class="btn btn-sm"
                  :disabled="!risk.correction.trim() || risk.submitting"
                  @click="submitCorrection(index)"
                >
                  {{ risk.submitting ? '提交中...' : '提交修正' }}
                </button>
              </div>
            </template>
            <button
              v-if="risk.submitted"
              class="btn btn-agree submitted"
              disabled
            >
              ✅ 已处理
            </button>
          </div>
        </div>

        <button
          class="btn btn-submit-feedback"
          :disabled="!hasFeedback"
          @click="submitFeedback"
        >
          {{ submittingFeedback ? '提交中...' : '📤 提交反馈' }}
        </button>
        <div v-if="feedbackMessage" class="feedback-result" :class="feedbackSuccess ? 'success' : 'error'">
          {{ feedbackMessage }}
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="history-section">
      <div class="history-header">
        <h2>📜 历史分析</h2>
        <button class="btn btn-sm btn-refresh" @click="loadHistory" :disabled="loadingHistory">
          {{ loadingHistory ? '...' : '🔄' }}
        </button>
      </div>

      <div v-if="loadingHistory" class="loading-small">
        <div class="spinner-small"></div>
        <span>加载历史记录...</span>
      </div>

      <div v-else-if="history.length === 0" class="history-empty">
        <p>暂无历史记录</p>
      </div>

      <div v-else class="history-list">
        <div v-for="item in history" :key="item.id || item.image_hash" class="history-item">
          <div class="history-thumb">
            <img v-if="item.thumbnail" :src="item.thumbnail" alt="缩略图" />
            <span v-else class="history-thumb-placeholder">📄</span>
          </div>
          <div class="history-info">
            <div class="history-time">{{ formatTime(item.created_at || item.timestamp) }}</div>
            <div class="hash">{{ item.image_hash || 'N/A' }}</div>
          </div>
          <button class="btn btn-sm btn-view" @click="viewHistoryItem(item)">查看</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'CADAnalysis',
  setup() {
    const fileInput = ref(null)
    const isDragOver = ref(false)
    const previewUrl = ref(null)
    const selectedFile = ref(null)
    const selectedBase64 = ref(null)
    const uploadError = ref('')

    const analyzing = ref(false)
    const analysisStep = ref(0)
    const analysisResult = ref(null)
    const annotatedImageUrl = ref(null)

    const history = ref([])
    const loadingHistory = ref(false)

    const feedbackMessage = ref('')
    const feedbackSuccess = ref(false)
    const submittingFeedback = ref(false)

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

    // 解析风险项
    const riskItems = ref([])

    // 渲染 Markdown 为 HTML
    const renderedMarkdown = computed(() => {
      if (!analysisResult.value?.analysis_text) return ''
      let text = analysisResult.value.analysis_text

      // 简单的 Markdown 渲染
      text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
      text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>')
      text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>')
      text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>')
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
      text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      text = text.replace(/\n\n/g, '</p><p>')
      text = text.replace(/\n/g, '<br/>')
      text = '<p>' + text + '</p>'

      // 清理空标签
      text = text.replace(/<p>\s*<\/p>/g, '')
      text = text.replace(/<p>\s*(<h[123]>)/g, '$1')
      text = text.replace(/(<\/h[123]>)\s*<\/p>/g, '$1')
      text = text.replace(/<p>\s*(<pre>)/g, '$1')
      text = text.replace(/(<\/pre>)\s*<\/p>/g, '$1')
      text = text.replace(/<p>\s*(<ul>)/g, '$1')
      text = text.replace(/(<\/ul>)\s*<\/p>/g, '$1')

      return text
    })

    const hasFeedback = computed(() => {
      return riskItems.value.some(r => r.feedback !== null)
    })

    // 文件处理
    const validateFile = (file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        uploadError.value = `不支持的文件格式: ${file.type}，请上传 JPG/PNG/WebP 格式的图片`
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        uploadError.value = `文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，最大支持 10MB`
        return false
      }
      uploadError.value = ''
      return true
    }

    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const onDragOver = () => {
      isDragOver.value = true
    }

    const onDragLeave = () => {
      isDragOver.value = false
    }

    const onDrop = async (e) => {
      isDragOver.value = false
      const files = e.dataTransfer.files
      if (files.length > 0) {
        await handleFile(files[0])
      }
    }

    const onFileSelect = async (e) => {
      const files = e.target.files
      if (files.length > 0) {
        await handleFile(files[0])
      }
    }

    const handleFile = async (file) => {
      if (!validateFile(file)) return
      selectedFile.value = file
      previewUrl.value = URL.createObjectURL(file)
      selectedBase64.value = await fileToBase64(file)
    }

    const replaceImage = () => {
      previewUrl.value = null
      selectedFile.value = null
      selectedBase64.value = null
      analysisResult.value = null
      annotatedImageUrl.value = null
      riskItems.value = []
      triggerFileInput()
    }

    // 分析
    const startAnalysis = async () => {
      if (!selectedBase64.value) return

      analyzing.value = true
      analysisStep.value = 1
      analysisResult.value = null
      annotatedImageUrl.value = null
      riskItems.value = []

      try {
        // 模拟步骤动画
        await new Promise(r => setTimeout(r, 600))
        analysisStep.value = 2
        await new Promise(r => setTimeout(r, 600))
        analysisStep.value = 3
        await new Promise(r => setTimeout(r, 400))

        const response = await fetch('/api/cad/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: selectedBase64.value })
        })

        if (!response.ok) {
          throw new Error(`分析失败: HTTP ${response.status}`)
        }

        const data = await response.json()
        analysisResult.value = data

        // 标注图片
        if (data.annotated_image_base64) {
          annotatedImageUrl.value = data.annotated_image_base64.startsWith('data:')
            ? data.annotated_image_base64
            : `data:image/png;base64,${data.annotated_image_base64}`
        }

        // 解析风险项
        parseRiskItems(data.analysis_text || '')

        analysisStep.value = 4
      } catch (error) {
        console.error('分析失败:', error)
        // 静默失败，不显示错误提示
        // uploadError.value = error.message || '分析失败，请重试'
      } finally {
        analyzing.value = false
      }
    }

    const parseRiskItems = (text) => {
      const risks = []
      const lines = text.split('\n')
      let currentRisk = null
      let inRiskSection = false

      for (const line of lines) {
        const trimmed = line.trim()

        // 匹配风险项: - 风险标题 或 * 风险标题 或 ⚠️ 风险标题 或 ### 风险标题
        const riskMatch = trimmed.match(/^[-*•]\s*(?:⚠️|🔴|🟡|🟢)?\s*\[?(高风险|中风险|低风险|严重|警告|建议|info|warning|critical|high|medium|low)\]?\s*[:：]?\s*(.+)/i)
          || trimmed.match(/^###\s*(?:⚠️|🔴|🟡|🟢)?\s*\[?(高风险|中风险|低风险|严重|警告|建议)\]?\s*[:：]?\s*(.+)/i)

        if (riskMatch) {
          if (currentRisk) risks.push(currentRisk)
          currentRisk = {
            level: classifyLevel(riskMatch[1]),
            levelText: riskMatch[1],
            title: riskMatch[2].trim(),
            description: '',
            feedback: null,
            correction: ''
          }
          inRiskSection = true
        } else if (inRiskSection && currentRisk && trimmed && !trimmed.match(/^#{1,3}\s/) && !trimmed.match(/^[-*]\s/)) {
          currentRisk.description += (currentRisk.description ? ' ' : '') + trimmed
        } else if (trimmed.match(/^#{1,3}\s/) || trimmed.match(/^---/) || trimmed.match(/^\*\*\*/)) {
          inRiskSection = false
        }
      }

      if (currentRisk) risks.push(currentRisk)

      // 如果没解析到具体风险，从列表项中提取
      if (risks.length === 0) {
        for (const line of lines) {
          const trimmed = line.trim()
          const listMatch = trimmed.match(/^[-*•]\s+(.+)/)
          if (listMatch && listMatch[1].length > 10) {
            risks.push({
              level: 'medium',
              levelText: '提示',
              title: listMatch[1].substring(0, 50),
              description: listMatch[1],
              feedback: null,
              correction: ''
            })
          }
        }
      }

      riskItems.value = risks
    }

    const classifyLevel = (level) => {
      const lower = level.toLowerCase()
      if (lower.includes('高') || lower.includes('critical') || lower.includes('严重')) return 'high'
      if (lower.includes('中') || lower.includes('warning') || lower.includes('medium')) return 'medium'
      return 'low'
    }

    // 反馈
    const setFeedback = async (index, type) => {
      riskItems.value[index].feedback = type
      if (type !== 'correct') {
        riskItems.value[index].correction = ''
      }
      
      // 如果是"同意"，立即提交到后端学习
      if (type === 'agree') {
        riskItems.value[index].submitting = true
        try {
          const imageHash = analysisResult.value?.image_hash || generateHash()
          const riskItem = riskItems.value[index]
          const body = {
            image_hash: imageHash,
            risk_item: `${riskItem.levelText}: ${riskItem.title}`,
            original_analysis: analysisResult.value?.analysis_text || '',
            user_correction: JSON.stringify({ action: 'agree', title: riskItem.title })
          }

          const resp = await fetch('/api/cad/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          if (resp.ok) {
            riskItems.value[index].submitted = true
            console.log(`风险项 "${riskItem.title}" 已标记为同意并记录`)
          }
        } catch (e) {
          console.error('提交反馈失败:', e)
        } finally {
          riskItems.value[index].submitting = false
        }
      }
    }

    const submitCorrection = async (index) => {
      const riskItem = riskItems.value[index]
      if (!riskItem.correction || !riskItem.correction.trim()) return
      
      riskItems.value[index].submitting = true
      riskItems.value[index].feedback = 'correct'
      try {
        const imageHash = analysisResult.value?.image_hash || generateHash()
        const body = {
          image_hash: imageHash,
          risk_item: `${riskItem.levelText}: ${riskItem.title}`,
          original_analysis: analysisResult.value?.analysis_text || '',
          user_correction: riskItem.correction
        }

        const resp = await fetch('/api/cad/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (resp.ok) {
          riskItems.value[index].submitted = true
          console.log(`修正 "${riskItem.title}" 已提交`)
        }
      } catch (e) {
        console.error('提交修正失败:', e)
      } finally {
        riskItems.value[index].submitting = false
      }
    }

    const submitFeedback = async () => {
      submittingFeedback.value = true
      feedbackMessage.value = ''

      try {
        const feedbacks = riskItems.value.filter(r => r.feedback !== null)
        const correctionData = feedbacks.map(r => ({
          level: r.levelText,
          title: r.title,
          description: r.description,
          feedback: r.feedback,
          correction: r.correction || ''
        }))

        const imageHash = analysisResult.value?.image_hash || generateHash()
        const body = {
          image_hash: imageHash,
          original_analysis: analysisResult.value?.analysis_text || '',
          user_correction: JSON.stringify(correctionData)
        }

        const response = await fetch('/api/cad/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          throw new Error(`提交失败: HTTP ${response.status}`)
        }

        const result = await response.json()
        feedbackMessage.value = result.message || '反馈提交成功，感谢你的帮助！'
        feedbackSuccess.value = true

        // 重置反馈状态
        riskItems.value.forEach(r => {
          r.feedback = null
          r.correction = ''
        })
      } catch (error) {
        console.error('提交反馈失败:', error)
        feedbackMessage.value = error.message || '提交失败，请重试'
        feedbackSuccess.value = false
      } finally {
        submittingFeedback.value = false
      }
    }

    const generateHash = () => {
      const str = selectedBase64.value || Date.now().toString()
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return Math.abs(hash).toString(16).padStart(8, '0')
    }

    // 历史记录
    const loadHistory = async () => {
      loadingHistory.value = true
      try {
        const response = await fetch('/api/cad/history')
        if (!response.ok) throw new Error('加载历史记录失败')
        const data = await response.json()
        history.value = Array.isArray(data) ? data : (data.records || data.items || [])
      } catch (error) {
        console.error('加载历史记录失败:', error)
        history.value = []
      } finally {
        loadingHistory.value = false
      }
    }

    const viewHistoryItem = (item) => {
      // 如果有标注图片，显示
      if (item.annotated_image_base64) {
        annotatedImageUrl.value = item.annotated_image_base64.startsWith('data:')
          ? item.annotated_image_base64
          : `data:image/png;base64,${item.annotated_image_base64}`
      }
      if (item.analysis_text) {
        analysisResult.value = item
        parseRiskItems(item.analysis_text)
      }
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return '未知时间'
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return timestamp
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    onMounted(() => {
      loadHistory()
    })

    return {
      fileInput, isDragOver, previewUrl, selectedFile, uploadError,
      analyzing, analysisStep, analysisResult, annotatedImageUrl,
      renderedMarkdown,
      riskItems, hasFeedback,
      feedbackMessage, feedbackSuccess, submittingFeedback,
      history, loadingHistory,
      triggerFileInput, onDragOver, onDragLeave, onDrop,
      onFileSelect, replaceImage, startAnalysis,
      setFeedback, submitCorrection, submitFeedback,
      loadHistory, viewHistoryItem, formatTime
    }
  }
}
</script>

<style scoped>
.cad-analysis {
  font-family: sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  min-height: calc(100vh - 80px);
  color: #fff;
}

/* 页面标题 */
.page-title {
  text-align: center;
  margin-bottom: 24px;
}
.page-title h1 {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #00d4ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.page-title .subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1rem;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 24px;
}
.upload-zone {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.upload-zone:hover {
  border-color: rgba(0, 212, 255, 0.5);
  background: rgba(0, 212, 255, 0.05);
}
.upload-zone.drag-over {
  border-color: #00d4ff;
  background: rgba(0, 212, 255, 0.1);
  transform: scale(1.01);
}
.upload-zone.has-image {
  padding: 0;
  cursor: default;
  border-style: solid;
  border-color: rgba(0, 212, 255, 0.3);
}
.upload-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}
.upload-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 8px;
}
.upload-link {
  color: #00d4ff;
  text-decoration: underline;
  cursor: pointer;
}
.upload-hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  margin: 0;
}
.preview-image {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  display: block;
}
.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  gap: 12px;
  justify-content: center;
}
.error-message {
  margin-top: 12px;
  padding: 10px 16px;
  background: rgba(255, 68, 68, 0.15);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 12px;
  color: #ff6b6b;
  font-size: 0.9rem;
}

/* 按钮 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn:hover {
  transform: translateY(-2px);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
  border-radius: 12px;
}
.btn-replace {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.btn-analyze {
  background: linear-gradient(135deg, #00d4ff, #667eea);
  color: white;
  box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
}
.btn-analyze:hover {
  box-shadow: 0 8px 25px rgba(0, 212, 255, 0.5);
}
.btn-refresh {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 分析中 */
.analyzing-section {
  margin-bottom: 24px;
}
.analyzing-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.analyzing-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(0, 212, 255, 0.2);
  border-top: 4px solid #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}
.analyzing-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 24px;
}
.analyzing-steps {
  display: flex;
  justify-content: center;
  gap: 32px;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  transition: all 0.3s ease;
}
.step.done {
  color: rgba(255, 255, 255, 0.9);
}
.step-icon {
  font-size: 1.4rem;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 结果区域 */
.results-section {
  margin-bottom: 24px;
}
.annotated-image-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
}
.annotated-image-section h2 {
  margin: 0 0 16px;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #00d4ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.image-container {
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
}
.annotated-image {
  max-width: 100%;
  max-height: 600px;
  object-fit: contain;
  border-radius: 8px;
}

/* 评分 */
.score-section {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.score-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 24px 40px;
  text-align: center;
  transition: all 0.3s ease;
}
.score-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.score-circle {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 8px;
}
.score-ring {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}
.score-ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 3;
}
.score-ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 1s ease;
}
.score-high .score-ring-fill { stroke: #00d4ff; }
.score-medium .score-ring-fill { stroke: #fbbf24; }
.score-low .score-ring-fill { stroke: #ff6b6b; }
.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.6rem;
  font-weight: bold;
}
.score-high .score-value { color: #00d4ff; }
.score-medium .score-value { color: #fbbf24; }
.score-low .score-value { color: #ff6b6b; }
.score-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

/* Markdown 内容 */
.analysis-content {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
}
.analysis-content h2 {
  margin: 0 0 16px;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #00d4ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.markdown-body {
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.7;
  font-size: 0.95rem;
}
.markdown-body :deep(h1) {
  font-size: 1.5rem;
  margin: 16px 0 8px;
  color: #fff;
}
.markdown-body :deep(h2) {
  font-size: 1.3rem;
  margin: 16px 0 8px;
  color: #fff;
}
.markdown-body :deep(h3) {
  font-size: 1.1rem;
  margin: 12px 0 6px;
  color: rgba(255, 255, 255, 0.9);
}
.markdown-body :deep(strong) {
  color: #00d4ff;
  font-weight: 600;
}
.markdown-body :deep(em) {
  color: rgba(255, 255, 255, 0.7);
}
.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  color: #a855f7;
}
.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: #0f0;
}
.markdown-body :deep(ul) {
  padding-left: 20px;
  margin: 8px 0;
}
.markdown-body :deep(li) {
  margin: 4px 0;
}

/* 学习反馈 */
.feedback-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
}
.feedback-section h2 {
  margin: 0 0 8px;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #00d4ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.feedback-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  margin: 0 0 20px;
}
.feedback-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 20px;
}
.feedback-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}
.feedback-card:hover {
  border-color: rgba(0, 212, 255, 0.2);
}
.feedback-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.risk-level {
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.risk-level.high {
  background: rgba(255, 68, 68, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 68, 68, 0.3);
}
.risk-level.medium {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}
.risk-level.low {
  background: rgba(0, 212, 255, 0.2);
  color: #00d4ff;
  border: 1px solid rgba(0, 212, 255, 0.3);
}
.risk-title {
  font-weight: 600;
  color: #fff;
  font-size: 0.95rem;
}
.risk-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  margin: 0 0 12px;
  line-height: 1.5;
}
.feedback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}
.btn-agree {
  background: rgba(0, 212, 255, 0.15);
  color: #00d4ff;
  border: 1px solid rgba(0, 212, 255, 0.3);
}
.btn-agree:hover, .btn-agree.selected {
  background: rgba(0, 212, 255, 0.3);
}
.btn-agree.submitted {
  background: rgba(34, 197, 94, 0.3);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.5);
}
.btn-agree:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-correct {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
  border: 1px solid rgba(168, 85, 247, 0.3);
}
.btn-correct:hover, .btn-correct.selected {
  background: rgba(168, 85, 247, 0.3);
}
.correction-input {
  width: 100%;
  margin-top: 8px;
}
.correction-input textarea {
  width: 100%;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  resize: vertical;
  font-family: inherit;
}
.correction-input textarea:focus {
  outline: none;
  border-color: #a855f7;
}
.correction-input textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.btn-submit-feedback {
  background: linear-gradient(135deg, #a855f7, #667eea);
  color: white;
  width: 100%;
  justify-content: center;
  margin-top: 12px;
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3);
}
.btn-submit-feedback:hover {
  box-shadow: 0 8px 25px rgba(168, 85, 247, 0.5);
}
.feedback-result {
  margin-top: 12px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 0.9rem;
  text-align: center;
}
.feedback-result.success {
  background: rgba(0, 255, 100, 0.15);
  color: #4ade80;
  border: 1px solid rgba(0, 255, 100, 0.3);
}
.feedback-result.error {
  background: rgba(255, 68, 68, 0.15);
  color: #ff6b6b;
  border: 1px solid rgba(255, 68, 68, 0.3);
}

/* 历史记录 */
.history-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.history-header h2 {
  margin: 0;
  font-size: 1.3rem;
  background: linear-gradient(135deg, #00d4ff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.loading-small {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.5);
}
.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 212, 255, 0.2);
  border-top: 2px solid #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.history-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 20px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: all 0.2s ease;
}
.history-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
.history-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.history-thumb-placeholder {
  font-size: 1.5rem;
}
.history-info {
  flex: 1;
  min-width: 0;
}
.history-time {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}
.hash {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-view {
  background: rgba(0, 212, 255, 0.15);
  color: #00d4ff;
  border: 1px solid rgba(0, 212, 255, 0.3);
  flex-shrink: 0;
}
.btn-view:hover {
  background: rgba(0, 212, 255, 0.3);
}

/* 响应式布局 */
@media (max-width: 768px) {
  .cad-analysis {
    padding: 12px;
  }
  .page-title h1 {
    font-size: 1.6rem;
  }
  .upload-zone {
    padding: 24px;
    min-height: 150px;
  }
  .upload-icon {
    font-size: 2rem;
  }
  .upload-text {
    font-size: 0.95rem;
  }
  .analyzing-steps {
    gap: 16px;
  }
  .step {
    font-size: 0.75rem;
  }
  .feedback-actions {
    flex-direction: column;
  }
  .btn-agree, .btn-correct {
    width: 100%;
    justify-content: center;
  }
}
</style>
