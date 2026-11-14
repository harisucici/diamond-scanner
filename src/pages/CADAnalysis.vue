<template>
  <div class="cad-analysis-page">
    <div class="cad-analysis-container">
      <!-- 标题区 -->
      <div class="page-header">
        <h1 class="page-title">CAD 图纸 AI 分析</h1>
        <p class="page-description">上传 CAD 图纸，AI 自动识别风险并给出优化建议</p>
      </div>

      <!-- 上传区域 -->
      <div
        v-if="!previewUrl && !analysisResult"
        class="upload-section"
      >
        <div
          class="upload-zone"
          :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          @click="triggerFileInput()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            @change="onFileSelect"
            class="file-input-hidden"
          />
          <div class="upload-content">
            <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="upload-text">拖拽图片到这里，或 <span class="upload-link">点击选择文件</span></p>
            <p class="upload-hint">支持 JPG / PNG / WebP，最大 10MB</p>
          </div>
        </div>

        <!-- 上传错误 -->
        <div v-if="uploadError" class="error-message">
          {{ uploadError }}
        </div>
      </div>

      <!-- 上传后预览 -->
      <div
        v-if="previewUrl && !analysisResult && !analyzing"
        class="preview-section"
      >
        <div class="preview-card">
          <img :src="previewUrl" alt="预览" class="preview-image" />
          <div class="preview-actions">
            <button class="btn btn-secondary" @click="replaceImage">替换图片</button>
            <button class="btn btn-primary" @click="startAnalysis">开始分析</button>
          </div>
        </div>
      </div>

      <!-- Loading 上传中 -->
      <div v-if="uploading" class="loading-section">
        <div class="loading-card">
          <div class="loading-header">
            <span class="loading-text">正在上传图片...</span>
            <span class="loading-percent">{{ uploadProgress }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 分析中 -->
      <div v-if="analyzing && !analysisResult" class="analyzing-section">
        <div class="analyzing-card">
          <!-- 骨架屏预览 -->
          <div class="skeleton-grid">
            <div class="skeleton-left">
              <div class="skeleton-title"></div>
              <div class="skeleton-image"></div>
            </div>
            <div class="skeleton-right">
              <div class="skeleton-subtitle"></div>
              <div class="skeleton-lines">
                <div class="skeleton-line"></div>
                <div class="skeleton-line line-long"></div>
                <div class="skeleton-line line-medium"></div>
                <div class="skeleton-line line-short"></div>
              </div>
            </div>
          </div>

          <!-- 步骤指示器 -->
          <div class="steps-container">
            <template v-for="(step, i) in analysisSteps" :key="i">
              <div class="step-item">
                <div
                  class="step-circle"
                  :class="{
                    'step-completed': analysisStep > i + 1,
                    'step-active': analysisStep === i + 1
                  }"
                >
                  <svg v-if="analysisStep > i + 1" class="step-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span class="step-label" :class="{ 'label-active': analysisStep >= i + 1 }">{{ step }}</span>
              </div>
              <div
                v-if="i < analysisSteps.length - 1"
                class="step-connector"
                :class="{ 'connector-completed': analysisStep > i + 1 }"
              ></div>
            </template>
          </div>
        </div>
      </div>

      <!-- 分析结果 -->
      <div v-if="analysisResult && !analyzing" class="result-section">
        <!-- 操作栏 -->
        <div class="result-header">
          <h2 class="result-title">分析结果</h2>
          <button class="btn btn-secondary" @click="resetAll">分析新图纸</button>
        </div>

        <!-- 主结果网格 -->
        <div class="result-grid">
          <!-- 左侧：标注图片 -->
          <div class="result-column">
            <h3 class="section-label">标注图纸</h3>
            <div class="image-container">
              <img
                v-if="annotatedImageUrl"
                :src="annotatedImageUrl"
                alt="AI 标注结果"
                class="annotated-image"
              />
              <div v-else class="empty-image">无标注图片</div>
            </div>
          </div>

          <!-- 右侧：Markdown 报告 -->
          <div class="result-column">
            <h3 class="section-label">分析报告</h3>
            <div class="report-container markdown-body" v-html="renderedMarkdown"></div>
          </div>
        </div>

        <!-- 风险反馈区 -->
        <div v-if="riskItems.length > 0" class="feedback-section">
          <h3 class="section-label">风险项反馈</h3>
          <div class="risk-grid">
            <div
              v-for="(risk, index) in riskItems"
              :key="index"
              class="risk-card"
            >
              <!-- 顶部：风险等级徽章 -->
              <div class="risk-header">
                <span class="risk-badge" :class="'badge-' + risk.level">{{ risk.levelText }}</span>
                <span class="risk-title">{{ risk.title }}</span>
              </div>

              <!-- 中间：风险描述 -->
              <div class="risk-body">
                <p class="risk-description">{{ risk.description }}</p>
              </div>

              <!-- 底部：操作按钮 -->
              <div class="risk-footer">
                <template v-if="!risk.submitted">
                  <button
                    class="feedback-btn"
                    :class="{ 'btn-agree': risk.feedback === 'agree' }"
                    :disabled="risk.submitting"
                    @click="setFeedback(index, 'agree')"
                  >
                    {{ risk.submitting && risk.feedback === 'agree' ? '提交中...' : '同意分析' }}
                  </button>
                  <button
                    class="feedback-btn"
                    :class="{ 'btn-correct': risk.feedback === 'correct' }"
                    @click="setFeedback(index, 'correct')"
                  >
                    需要修正
                  </button>
                </template>
                <template v-else>
                  <span class="submitted-text">
                    <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    已处理
                  </span>
                </template>
              </div>

              <!-- 修正输入区 -->
              <div v-if="risk.feedback === 'correct' && !risk.submitted" class="correction-area">
                <textarea
                  v-model="risk.correction"
                  placeholder="请输入正确的分析结果..."
                  rows="3"
                  class="correction-input"
                ></textarea>
                <button
                  class="btn btn-primary btn-small"
                  :disabled="!risk.correction.trim() || risk.submitting"
                  @click="submitCorrection(index)"
                >
                  {{ risk.submitting ? '提交中...' : '提交修正' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 批量提交反馈 -->
          <div class="submit-area">
            <button
              class="btn btn-primary"
              :disabled="!hasFeedback || submittingFeedback"
              @click="submitFeedback"
            >
              {{ submittingFeedback ? '提交中...' : '提交反馈' }}
            </button>
            <span v-if="feedbackMessage" class="feedback-message" :class="{ 'message-success': feedbackSuccess }">
              {{ feedbackMessage }}
            </span>
          </div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div class="history-section">
        <div class="history-header">
          <h3 class="section-label">历史分析</h3>
          <button
            class="btn-icon"
            :disabled="loadingHistory"
            @click="loadHistory"
          >
            <svg class="refresh-icon" :class="{ 'rotating': loadingHistory }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div v-if="loadingHistory && history.length === 0" class="empty-state">加载中...</div>
        <div v-else-if="history.length === 0" class="empty-state">暂无历史记录</div>
        <div v-else class="history-scroll">
          <div
            v-for="item in history"
            :key="item.id || item.image_hash"
            class="history-item"
            @click="viewHistoryItem(item)"
          >
            <div class="history-thumbnail">
              <img v-if="item.thumbnail" :src="item.thumbnail" alt="缩略图" class="thumbnail-image" />
              <div v-else class="thumbnail-placeholder">
                <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="history-info">
              <p class="history-time">{{ formatTime(item.created_at || item.timestamp) }}</p>
              <p class="history-hash">{{ item.image_hash || 'N/A' }}</p>
            </div>
          </div>
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

    const uploading = ref(false)
    const uploadProgress = ref(0)
    const analyzing = ref(false)
    const analysisStep = ref(0)
    const analysisResult = ref(null)
    const annotatedImageUrl = ref(null)

    const analysisSteps = ['图像识别', '风险评估', '生成报告']

    const history = ref([])
    const loadingHistory = ref(false)

    const feedbackMessage = ref('')
    const feedbackSuccess = ref(false)
    const submittingFeedback = ref(false)

    const MAX_FILE_SIZE = 10 * 1024 * 1024
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

    const riskItems = ref([])

    const renderedMarkdown = computed(() => {
      if (!analysisResult.value?.analysis_text) return ''
      let text = analysisResult.value.analysis_text

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

    const resetAll = () => {
      previewUrl.value = null
      selectedFile.value = null
      selectedBase64.value = null
      analysisResult.value = null
      annotatedImageUrl.value = null
      riskItems.value = []
      uploadError.value = ''
      feedbackMessage.value = ''
    }

    // 分析
    const startAnalysis = async () => {
      if (!selectedBase64.value) return

      // 模拟上传进度
      uploading.value = true
      uploadProgress.value = 0
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) {
          uploadProgress.value += Math.random() * 15 + 5
          if (uploadProgress.value > 90) uploadProgress.value = 90
        }
      }, 200)

      analyzing.value = true
      analysisStep.value = 1
      analysisResult.value = null
      annotatedImageUrl.value = null
      riskItems.value = []

      try {
        // 步骤动画
        await new Promise(r => setTimeout(r, 800))
        analysisStep.value = 2
        await new Promise(r => setTimeout(r, 800))
        analysisStep.value = 3

        const response = await fetch('/api/cad/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: selectedBase64.value })
        })

        if (!response.ok) {
          throw new Error(`分析失败: HTTP ${response.status}`)
        }

        clearInterval(progressInterval)
        uploadProgress.value = 100
        await new Promise(r => setTimeout(r, 300))
        uploading.value = false

        const data = await response.json()
        analysisResult.value = data

        if (data.annotated_image_base64) {
          annotatedImageUrl.value = data.annotated_image_base64.startsWith('data:')
            ? data.annotated_image_base64
            : `data:image/png;base64,${data.annotated_image_base64}`
        }

        parseRiskItems(data.analysis_text || '')
        analysisStep.value = 4
      } catch (error) {
        console.error('分析失败:', error)
        clearInterval(progressInterval)
        uploading.value = false
        analyzing.value = false
        uploadError.value = error.message || '分析失败，请重试'
      } finally {
        analyzing.value = analysisResult.value === null
      }
    }

    const parseRiskItems = (text) => {
      const risks = []
      const lines = text.split('\n')
      let currentRisk = null
      let inRiskSection = false

      for (const line of lines) {
        const trimmed = line.trim()

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
            correction: '',
            submitting: false,
            submitted: false
          }
          inRiskSection = true
        } else if (inRiskSection && currentRisk && trimmed && !trimmed.match(/^#{1,3}\s/) && !trimmed.match(/^[-*]\s/)) {
          currentRisk.description += (currentRisk.description ? ' ' : '') + trimmed
        } else if (trimmed.match(/^#{1,3}\s/) || trimmed.match(/^---/) || trimmed.match(/^\*\*\*/)) {
          inRiskSection = false
        }
      }

      if (currentRisk) risks.push(currentRisk)

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
              correction: '',
              submitting: false,
              submitted: false
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
      uploading, uploadProgress,
      analyzing, analysisStep, analysisSteps, analysisResult, annotatedImageUrl,
      renderedMarkdown,
      riskItems, hasFeedback,
      feedbackMessage, feedbackSuccess, submittingFeedback,
      history, loadingHistory,
      triggerFileInput, onDragOver, onDragLeave, onDrop,
      onFileSelect, replaceImage, resetAll, startAnalysis,
      setFeedback, submitCorrection, submitFeedback,
      loadHistory, viewHistoryItem, formatTime
    }
  }
}
</script>

<style scoped>
.cad-analysis-page {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  padding: 2.5rem 1.5rem;
}

.cad-analysis-container {
  max-width: 80rem;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--foreground);
  margin: 0 0 0.5rem 0;
}

.page-description {
  font-size: 1rem;
  color: var(--muted-foreground);
  margin: 0;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 2.5rem;
  position: relative;
  transition: all 0.3s ease;
}

.upload-zone {
  border: 2px dashed var(--border);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-zone:hover {
  border-color: var(--accent-hover);
}

.upload-zone.drag-over {
  border-color: var(--accent);
  background: var(--accent-light);
}

.upload-content {
  padding: 5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.file-input-hidden {
  display: none;
}

.upload-icon {
  width: 4rem;
  height: 4rem;
  color: var(--muted-foreground);
  margin-bottom: 1.5rem;
}

.upload-text {
  font-size: 1.125rem;
  color: var(--foreground);
  margin: 0 0 0.5rem 0;
}

.upload-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.upload-hint {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--error-border);
  background: var(--error-bg);
  color: var(--error);
  font-size: 0.875rem;
}

/* 预览区域 */
.preview-section {
  margin-bottom: 2.5rem;
  animation: fadeIn 0.4s ease-out;
}

.preview-card {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--border);
}

.preview-image {
  width: 100%;
  max-height: 30rem;
  object-fit: contain;
  background: var(--card-bg);
  display: block;
}

.preview-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 1.25rem;
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

/* Loading 区域 */
.loading-section {
  margin-bottom: 2.5rem;
  animation: fadeIn 0.4s ease-out;
}

.loading-card {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 2rem;
}

.loading-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--foreground);
}

.loading-percent {
  font-size: 0.875rem;
  font-family: monospace;
  color: var(--accent);
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  background: var(--border);
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 0.25rem;
  transition: width 0.3s ease;
}

/* 分析中区域 */
.analyzing-section {
  margin-bottom: 2.5rem;
  animation: fadeIn 0.4s ease-out;
}

.analyzing-card {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 2.5rem;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.skeleton-left,
.skeleton-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton-title,
.skeleton-subtitle {
  height: 1.5rem;
  background: var(--skeleton);
  border-radius: 0.25rem;
  animation: pulse 2s ease-in-out infinite;
}

.skeleton-title {
  width: 10rem;
}

.skeleton-subtitle {
  width: 8rem;
}

.skeleton-image {
  aspect-ratio: 4/3;
  background: var(--skeleton-light);
  border-radius: 0.75rem;
  animation: pulse 2s ease-in-out infinite;
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-line {
  height: 1rem;
  background: var(--skeleton-lighter);
  border-radius: 0.25rem;
  animation: pulse 2s ease-in-out infinite;
}

.line-long {
  width: 83%;
}

.line-medium {
  width: 67%;
}

.line-short {
  width: 75%;
}

.steps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
}

.step-circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.5s ease;
  background: var(--step-bg);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
}

.step-completed {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.step-active {
  background: var(--step-active-bg);
  border: 2px solid var(--accent);
  color: var(--accent);
  animation: pulse 2s ease-in-out infinite;
}

.step-check {
  width: 1.25rem;
  height: 1.25rem;
}

.step-label {
  font-size: 0.75rem;
  transition: color 0.3s ease;
  color: var(--muted-foreground);
}

.label-active {
  color: var(--foreground);
}

.step-connector {
  height: 1px;
  width: 4rem;
  margin-bottom: 1.5rem;
  transition: background 0.5s ease;
  background: var(--border);
}

.connector-completed {
  background: var(--accent-border);
}

/* 结果区域 */
.result-section {
  margin-bottom: 2.5rem;
  animation: slideIn 0.5s ease-out;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.result-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}

.result-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.result-column {
  display: flex;
  flex-direction: column;
}

.section-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted-foreground);
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.image-container {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  overflow: hidden;
  background: var(--image-bg);
  min-height: 20rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.annotated-image {
  width: 100%;
  max-height: 37.5rem;
  object-fit: contain;
  display: block;
}

.empty-image {
  padding: 5rem 0;
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.report-container {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 1.5rem;
  max-height: 37.5rem;
  overflow-y: auto;
}

/* 反馈区域 */
.feedback-section {
  margin-bottom: 2.5rem;
}

.risk-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .risk-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.risk-card {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.risk-card:hover {
  border-color: var(--border-hover);
}

.risk-header {
  padding: 1rem 1.25rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.risk-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-high {
  background: var(--badge-high-bg);
  color: var(--badge-high);
  border: 1px solid var(--badge-high-border);
}

.badge-medium {
  background: var(--badge-medium-bg);
  color: var(--badge-medium);
  border: 1px solid var(--badge-medium-border);
}

.badge-low {
  background: var(--badge-low-bg);
  color: var(--badge-low);
  border: 1px solid var(--badge-low-border);
}

.risk-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-body {
  padding: 0 1.25rem 0.75rem;
}

.risk-description {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.risk-footer {
  padding: 0 1.25rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.feedback-btn {
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--foreground);
  cursor: pointer;
}

.feedback-btn:hover:not(:disabled) {
  background: var(--btn-hover);
}

.feedback-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-agree {
  background: var(--btn-agree-bg);
  color: var(--accent);
  border-color: var(--btn-agree-border);
}

.btn-correct {
  background: var(--btn-correct-bg);
  color: var(--foreground);
  border-color: var(--btn-correct-border);
}

.submitted-text {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--success);
}

.check-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.correction-area {
  border-top: 1px solid var(--border);
  padding: 1rem 1.25rem;
  animation: fadeIn 0.3s ease-out;
}

.correction-input {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--foreground);
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.correction-input:focus {
  outline: none;
  border-color: var(--accent-border);
}

.correction-input::placeholder {
  color: var(--muted-foreground);
}

.submit-area {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.feedback-message {
  font-size: 0.875rem;
}

.message-success {
  color: var(--success);
}

/* 历史记录 */
.history-section {
  margin-bottom: 2.5rem;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.btn-icon {
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: var(--btn-bg);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon:hover:not(:disabled) {
  color: var(--foreground);
  background: var(--btn-hover);
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.refresh-icon {
  width: 1rem;
  height: 1rem;
}

.rotating {
  animation: rotate 1s linear infinite;
}

.empty-state {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  padding: 1.5rem 0;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
}

.history-scroll {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar) transparent;
}

.history-scroll::-webkit-scrollbar {
  height: 6px;
}

.history-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.history-scroll::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 3px;
}

.history-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover);
}

.history-item {
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.history-item:hover {
  transform: scale(1.05);
}

.history-thumbnail {
  width: 6rem;
  height: 6rem;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--card-bg);
  transition: border-color 0.2s ease;
}

.history-item:hover .history-thumbnail {
  border-color: var(--accent-border);
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
}

.placeholder-icon {
  width: 2rem;
  height: 2rem;
}

.history-info {
  margin-top: 0.5rem;
  width: 6rem;
}

.history-time {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0 0.25rem 0;
}

.history-hash {
  font-size: 0.625rem;
  color: var(--muted-foreground-light);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}

/* Markdown 渲染 */
.markdown-body :deep(h1) {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--foreground);
  margin: 1rem 0 0.5rem;
}

.markdown-body :deep(h2) {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0.875rem 0 0.5rem;
}

.markdown-body :deep(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0.75rem 0 0.375rem;
}

.markdown-body :deep(p) {
  color: var(--foreground);
  line-height: 1.7;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.markdown-body :deep(strong) {
  color: var(--accent);
  font-weight: 600;
}

.markdown-body :deep(em) {
  color: var(--muted-foreground);
  font-style: italic;
}

.markdown-body :deep(code) {
  background: var(--code-bg);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
  color: var(--accent);
}

.markdown-body :deep(pre) {
  background: var(--pre-bg);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--foreground);
}

.markdown-body :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}

.markdown-body :deep(li) {
  color: var(--foreground);
  font-size: 0.9rem;
  margin: 0.25rem 0;
  line-height: 1.6;
}

/* 按钮 */
.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--border);
}

.btn-secondary {
  background: var(--btn-bg);
  color: var(--foreground);
}

.btn-secondary:hover {
  background: var(--btn-hover);
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  margin-top: 0.75rem;
}

/* 动画 */
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

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .result-grid,
  .skeleton-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .steps-container {
    flex-direction: column;
    gap: 1rem;
  }

  .step-connector {
    display: none;
  }
}
</style>
