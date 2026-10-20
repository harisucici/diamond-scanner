<template>
  <div class="min-h-screen bg-[#0a0a0a] text-white">
    <div class="max-w-7xl mx-auto px-6 py-10">

      <!-- 标题区 -->
      <div class="mb-10">
        <h1 class="text-4xl font-bold tracking-tight text-white">CAD 图纸 AI 分析</h1>
        <p class="text-base text-gray-400 mt-2">上传 CAD 图纸，AI 自动识别风险并给出优化建议</p>
      </div>

      <!-- 上传区域 -->
      <div
        v-if="!previewUrl && !analysisResult"
        class="relative mb-10 transition-all duration-300"
      >
        <div
          class="upload-zone border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
          :class="[
            isDragOver
              ? 'border-[#d4a574] bg-[#d4a574]/5'
              : 'border-white/20 hover:border-[#d4a574]/60'
          ]"
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
            class="hidden"
          />
          <div class="py-20 px-8 flex flex-col items-center">
            <svg class="w-16 h-16 text-gray-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-lg text-gray-300 mb-2">拖拽图片到这里，或 <span class="text-[#d4a574] underline underline-offset-2">点击选择文件</span></p>
            <p class="text-sm text-gray-500">支持 JPG / PNG / WebP，最大 10MB</p>
          </div>
        </div>

        <!-- 上传错误 -->
        <div
          v-if="uploadError"
          class="mt-4 px-4 py-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm"
        >
          {{ uploadError }}
        </div>
      </div>

      <!-- 上传后预览 -->
      <div
        v-if="previewUrl && !analysisResult && !analyzing"
        class="mb-10 animate-fade-in"
      >
        <div class="relative rounded-2xl overflow-hidden border border-white/10">
          <img :src="previewUrl" alt="预览" class="w-full max-h-[480px] object-contain bg-black/40" />
          <div class="absolute bottom-0 left-0 right-0 bg-black/70 p-5 flex gap-3 justify-center">
            <button
              class="px-5 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-medium hover:bg-white/15 transition-colors"
              @click="replaceImage"
            >
              替换图片
            </button>
            <button
              class="px-5 py-2.5 rounded-lg bg-[#d4a574] text-black text-sm font-semibold hover:bg-[#c4955f] transition-colors"
              @click="startAnalysis"
            >
              开始分析
            </button>
          </div>
        </div>
      </div>

      <!-- Loading 上传中 -->
      <div v-if="uploading" class="mb-10 animate-fade-in">
        <div class="rounded-xl border border-white/10 bg-white/[0.03] p-8">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-300">正在上传图片...</span>
            <span class="text-sm font-mono text-[#d4a574]">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full bg-[#d4a574] rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 分析中 -->
      <div v-if="analyzing && !analysisResult" class="mb-10 animate-fade-in">
        <div class="rounded-xl border border-white/10 bg-white/[0.03] p-10">
          <!-- 骨架屏预览 -->
          <div class="grid grid-cols-[3fr_2fr] gap-8 mb-10">
            <div class="space-y-4">
              <div class="h-6 w-40 bg-white/10 rounded animate-pulse"></div>
              <div class="aspect-[4/3] bg-white/[0.05] rounded-xl animate-pulse"></div>
            </div>
            <div class="space-y-4">
              <div class="h-6 w-32 bg-white/10 rounded animate-pulse"></div>
              <div class="space-y-3">
                <div class="h-4 bg-white/[0.07] rounded animate-pulse"></div>
                <div class="h-4 bg-white/[0.07] rounded w-5/6 animate-pulse"></div>
                <div class="h-4 bg-white/[0.07] rounded w-4/6 animate-pulse"></div>
                <div class="h-4 bg-white/[0.07] rounded w-3/4 animate-pulse"></div>
              </div>
            </div>
          </div>

          <!-- 步骤指示器 -->
          <div class="flex items-center justify-center gap-0">
            <template v-for="(step, i) in analysisSteps" :key="i">
              <div class="flex flex-col items-center gap-2 min-w-[100px]">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500"
                  :class="[
                    analysisStep > i + 1
                      ? 'bg-[#d4a574] text-black'
                      : analysisStep === i + 1
                        ? 'bg-[#d4a574]/20 border-2 border-[#d4a574] text-[#d4a574] animate-pulse'
                        : 'bg-white/5 border border-white/10 text-gray-500'
                  ]"
                >
                  <svg v-if="analysisStep > i + 1" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span
                  class="text-xs transition-colors duration-300"
                  :class="analysisStep >= i + 1 ? 'text-white' : 'text-gray-500'"
                >{{ step }}</span>
              </div>
              <div
                v-if="i < analysisSteps.length - 1"
                class="h-px w-16 mb-6 transition-colors duration-500"
                :class="analysisStep > i + 1 ? 'bg-[#d4a574]/40' : 'bg-white/10'"
              ></div>
            </template>
          </div>
        </div>
      </div>

      <!-- 分析结果 -->
      <div
        v-if="analysisResult && !analyzing"
        class="mb-10 animate-slide-in"
      >
        <!-- 操作栏 -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">分析结果</h2>
          <button
            class="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-colors"
            @click="resetAll"
          >
            分析新图纸
          </button>
        </div>

        <!-- 主结果网格 -->
        <div class="grid grid-cols-[3fr_2fr] gap-8 mb-10">
          <!-- 左侧：标注图片 -->
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">标注图纸</h3>
            <div class="rounded-xl border border-white/10 overflow-hidden bg-black/30">
              <img
                v-if="annotatedImageUrl"
                :src="annotatedImageUrl"
                alt="AI 标注结果"
                class="w-full max-h-[600px] object-contain"
              />
              <div v-else class="py-20 flex items-center justify-center text-gray-500 text-sm">
                无标注图片
              </div>
            </div>
          </div>

          <!-- 右侧：Markdown 报告 -->
          <div>
            <h3 class="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">分析报告</h3>
            <div
              class="rounded-xl border border-white/10 bg-white/[0.03] p-6 max-h-[600px] overflow-y-auto markdown-body"
              v-html="renderedMarkdown"
            ></div>
          </div>
        </div>

        <!-- 风险反馈区 -->
        <div v-if="riskItems.length > 0" class="mb-10">
          <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">风险项反馈</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="(risk, index) in riskItems"
              :key="index"
              class="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden transition-colors hover:border-white/20"
            >
              <!-- 顶部：风险等级徽章 -->
              <div class="px-5 pt-4 pb-2 flex items-center gap-2">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold"
                  :class="{
                    'bg-red-500/15 text-red-400 border border-red-500/20': risk.level === 'high',
                    'bg-amber-500/15 text-amber-400 border border-amber-500/20': risk.level === 'medium',
                    'bg-sky-500/15 text-sky-400 border border-sky-500/20': risk.level === 'low'
                  }"
                >
                  {{ risk.levelText }}
                </span>
                <span class="text-sm font-medium text-white truncate">{{ risk.title }}</span>
              </div>

              <!-- 中间：风险描述 -->
              <div class="px-5 pb-3">
                <p class="text-sm text-gray-400 leading-relaxed line-clamp-3">{{ risk.description }}</p>
              </div>

              <!-- 底部：操作按钮 -->
              <div class="px-5 pb-4 flex items-center gap-2 flex-wrap">
                <template v-if="!risk.submitted">
                  <button
                    class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    :class="risk.feedback === 'agree'
                      ? 'bg-[#d4a574]/20 text-[#d4a574] border border-[#d4a574]/30'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'"
                    :disabled="risk.submitting"
                    @click="setFeedback(index, 'agree')"
                  >
                    {{ risk.submitting && risk.feedback === 'agree' ? '提交中...' : '同意分析' }}
                  </button>
                  <button
                    class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    :class="risk.feedback === 'correct'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'"
                    @click="setFeedback(index, 'correct')"
                  >
                    需要修正
                  </button>
                </template>
                <template v-else>
                  <span class="inline-flex items-center gap-1.5 text-xs text-green-400">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    已处理
                  </span>
                </template>
              </div>

              <!-- 修正输入区 -->
              <div
                v-if="risk.feedback === 'correct' && !risk.submitted"
                class="border-t border-white/5 px-5 py-4 animate-fade-in"
              >
                <textarea
                  v-model="risk.correction"
                  placeholder="请输入正确的分析结果..."
                  rows="3"
                  class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-y focus:outline-none focus:border-[#d4a574]/50 transition-colors"
                ></textarea>
                <button
                  class="mt-3 px-4 py-2 rounded-lg bg-[#d4a574] text-black text-xs font-semibold hover:bg-[#c4955f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="!risk.correction.trim() || risk.submitting"
                  @click="submitCorrection(index)"
                >
                  {{ risk.submitting ? '提交中...' : '提交修正' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 批量提交反馈 -->
          <div class="mt-6 flex items-center gap-4">
            <button
              class="px-6 py-2.5 rounded-lg bg-[#d4a574] text-black text-sm font-semibold hover:bg-[#c4955f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!hasFeedback || submittingFeedback"
              @click="submitFeedback"
            >
              {{ submittingFeedback ? '提交中...' : '提交反馈' }}
            </button>
            <span
              v-if="feedbackMessage"
              class="text-sm"
              :class="feedbackSuccess ? 'text-green-400' : 'text-red-400'"
            >
              {{ feedbackMessage }}
            </span>
          </div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider">历史分析</h3>
          <button
            class="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            :disabled="loadingHistory"
            @click="loadHistory"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': loadingHistory }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div v-if="loadingHistory && history.length === 0" class="text-sm text-gray-500 py-6 text-center">
          加载中...
        </div>

        <div v-else-if="history.length === 0" class="text-sm text-gray-500 py-6 text-center border border-dashed border-white/10 rounded-xl">
          暂无历史记录
        </div>

        <div v-else class="history-scroll flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          <div
            v-for="item in history"
            :key="item.id || item.image_hash"
            class="group flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105"
            @click="viewHistoryItem(item)"
          >
            <div class="w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-black/30 group-hover:border-[#d4a574]/40 transition-colors">
              <img
                v-if="item.thumbnail"
                :src="item.thumbnail"
                alt="缩略图"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-600">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="mt-2 w-24">
              <p class="text-xs text-gray-400 truncate">{{ formatTime(item.created_at || item.timestamp) }}</p>
              <p class="text-[10px] text-gray-600 font-mono truncate">{{ item.image_hash || 'N/A' }}</p>
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
/* Markdown 渲染样式 */
.markdown-body :deep(h1) {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 1rem 0 0.5rem;
}
.markdown-body :deep(h2) {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin: 0.875rem 0 0.5rem;
}
.markdown-body :deep(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0.75rem 0 0.375rem;
}
.markdown-body :deep(p) {
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.7;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}
.markdown-body :deep(strong) {
  color: #d4a574;
  font-weight: 600;
}
.markdown-body :deep(em) {
  color: rgba(255, 255, 255, 0.6);
}
.markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  color: #d4a574;
}
.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: rgba(255, 255, 255, 0.8);
}
.markdown-body :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}
.markdown-body :deep(li) {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
  margin: 0.25rem 0;
  line-height: 1.6;
}

/* 历史记录横向滚动 */
.history-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.history-scroll::-webkit-scrollbar {
  height: 6px;
}
.history-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.history-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.history-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
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

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

.animate-slide-in {
  animation: slideIn 0.5s ease-out forwards;
}

/* line-clamp */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
