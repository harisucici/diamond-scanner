<template>
  <div class="social-search">
    <!-- 页面标题区 -->
    <header class="header">
      <h1 class="header-title">社交平台宝石检索</h1>
      <p class="header-subtitle">TikTok & Instagram 彩色宝石视频与内容收藏</p>
    </header>

    <!-- 平台切换 -->
    <div class="platform-tabs">
      <button 
        :class="['platform-tab', { active: currentPlatform === 'tiktok' }]" 
        @click="currentPlatform = 'tiktok'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
        <span>TikTok</span>
      </button>
      <button 
        :class="['platform-tab', { active: currentPlatform === 'instagram' }]" 
        @click="currentPlatform = 'instagram'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
        <span>Instagram</span>
      </button>
    </div>

    <!-- 搜索关键词区 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          快速搜索
        </h2>
      </div>
      <div class="keyword-tags">
        <a 
          v-for="kw in currentKeywords" 
          :key="kw.label"
          :href="kw.url"
          target="_blank"
          class="keyword-tag"
        >
          {{ kw.label }}
        </a>
      </div>
      <div class="search-row">
        <input 
          type="text" 
          v-model="customKeyword" 
          :placeholder="currentPlatform === 'tiktok' ? '自定义 TikTok 关键词...' : '自定义 Instagram 标签...'"
          class="search-input"
          @keyup.enter="searchCustom"
        >
        <button class="btn btn-secondary" @click="searchCustom">搜索</button>
      </div>
    </div>

    <!-- 添加内容区 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加{{ currentPlatform === 'tiktok' ? '视频' : '内容' }}链接
        </h2>
      </div>
      <p class="hint">
        粘贴{{ currentPlatform === 'tiktok' ? ' TikTok 视频' : ' Instagram 帖子' }}链接,每行一个
      </p>
      <textarea 
        v-model="linksInput" 
        :placeholder="currentPlatform === 'tiktok' 
          ? 'https://www.tiktok.com/@xxx/video/7xxxx\nhttps://www.tiktok.com/@yyy/video/7yyyy' 
          : 'https://www.instagram.com/p/XXXX/\nhttps://www.instagram.com/reel/XXXX/'"
        class="links-textarea"
      ></textarea>
      <div class="action-row">
        <button class="btn btn-primary" @click="addLinks">添加</button>
        <button class="btn btn-secondary" @click="exportJSON">导出 JSON</button>
        <button class="btn btn-danger" @click="clearAll">清空全部</button>
      </div>
    </div>

    <!-- 统计区 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          收藏列表
        </h2>
        <span class="badge">{{ currentItems.length }}</span>
      </div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ currentItems.length }}</div>
          <div class="stat-label">总{{ currentPlatform === 'tiktok' ? '视频' : '内容' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ currentAuthors.size }}</div>
          <div class="stat-label">创作者</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatRelativeTime(latestAddTime) }}</div>
          <div class="stat-label">最近添加</div>
        </div>
      </div>

      <!-- 内容列表 -->
      <div v-if="currentItems.length" class="items-grid">
        <div v-for="item in currentItems" :key="item.url" class="item-card">
          <button class="item-remove" @click="removeItem(item.url)" title="移除">×</button>
          <div class="item-header">
            <span class="item-author">@{{ item.author }}</span>
            <span class="item-platform">{{ item.platform === 'tiktok' ? 'TikTok' : 'Instagram' }}</span>
          </div>
          <div class="item-id">{{ item.id.slice(0, 16) }}{{ item.id.length > 16 ? '...' : '' }}</div>
          <div class="item-actions">
            <a :href="item.url" target="_blank" class="item-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              打开
            </a>
            <button class="item-link" @click="copyUrl(item.url)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              复制
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <p>还没有收藏内容,快去搜索吧</p>
      </div>
    </div>

    <!-- 总结区 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          内容总结
        </h2>
      </div>
      <p class="hint">记录观察到的趋势、热门创作者、值得关注的宝石品类等</p>
      <textarea 
        v-model="summary" 
        placeholder="在这里写下你的观察与总结..."
        class="summary-textarea"
      ></textarea>
      <div class="action-row">
        <button class="btn btn-primary" @click="saveSummary">保存总结</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'SocialSearch',
  setup() {
    const currentPlatform = ref('tiktok')
    const customKeyword = ref('')
    const linksInput = ref('')
    const summary = ref('')
    const tiktokItems = ref([])
    const instagramItems = ref([])

    const TIKTOK_KEYWORDS = [
      { label: '彩色宝石', query: 'colored%20gemstones' },
      { label: '红宝石', query: 'ruby%20gemstone' },
      { label: '蓝宝石', query: 'sapphire%20gemstone' },
      { label: '祖母绿', query: 'emerald%20gemstone' },
      { label: '帕拉伊巴碧玺', query: 'paraiba%20tourmaline' },
      { label: '尖晶石', query: 'spinel%20gemstone' },
      { label: '沙弗莱', query: 'tsavorite%20gemstone' },
      { label: '矿石开采', query: 'gemstone%20mining' },
      { label: '泰国宝石', query: 'thailand%20gemstone' },
      { label: '斯里兰卡宝石', query: 'sri%20lanka%20gemstone' },
      { label: '宝石切割', query: 'gemstone%20cutting' },
      { label: '珠宝收藏', query: 'jewelry%20collection%20gem' },
    ]

    const INSTAGRAM_KEYWORDS = [
      { label: '#coloredgemstones', tag: 'coloredgemstones' },
      { label: '#ruby', tag: 'ruby' },
      { label: '#sapphire', tag: 'sapphire' },
      { label: '#emerald', tag: 'emerald' },
      { label: '#paraibatourmaline', tag: 'paraibatourmaline' },
      { label: '#spinel', tag: 'spinel' },
      { label: '#tsavorite', tag: 'tsavorite' },
      { label: '#gemstonemining', tag: 'gemstonemining' },
      { label: '#thaigemstones', tag: 'thaigemstones' },
      { label: '#gemstonecutting', tag: 'gemstonecutting' },
      { label: '#jewelrycollection', tag: 'jewelrycollection' },
      { label: '#gemstone', tag: 'gemstone' },
    ]

    const currentKeywords = computed(() => {
      if (currentPlatform.value === 'tiktok') {
        return TIKTOK_KEYWORDS.map(k => ({
          label: k.label,
          url: `https://www.tiktok.com/search?q=${k.query}`
        }))
      } else {
        return INSTAGRAM_KEYWORDS.map(k => ({
          label: k.label,
          url: `https://www.instagram.com/explore/tags/${k.tag}/`
        }))
      }
    })

    const currentItems = computed(() => {
      return currentPlatform.value === 'tiktok' ? tiktokItems.value : instagramItems.value
    })

    const currentAuthors = computed(() => {
      return new Set(currentItems.value.map(i => i.author).filter(a => a && a !== 'unknown'))
    })

    const latestAddTime = computed(() => {
      const times = currentItems.value.map(i => i.addedAt).filter(Boolean)
      return times.length ? times.sort().pop() : null
    })

    const searchCustom = () => {
      if (!customKeyword.value.trim()) return
      const q = encodeURIComponent(customKeyword.value.trim())
      const url = currentPlatform.value === 'tiktok'
        ? `https://www.tiktok.com/search?q=${q}`
        : `https://www.instagram.com/explore/tags/${q}/`
      window.open(url, '_blank')
    }

    const extractInfo = (url, platform) => {
      try {
        const u = new URL(url.trim())
        const parts = u.pathname.split('/').filter(Boolean)
        
        if (platform === 'tiktok') {
          const vidIdx = parts.indexOf('video')
          let id = '', author = ''
          if (vidIdx >= 0 && parts[vidIdx + 1]) id = parts[vidIdx + 1]
          const atIdx = parts.indexOf('@')
          if (atIdx >= 0 && parts[atIdx + 1]) author = parts[atIdx + 1]
          return { id: id || url, author: author || 'unknown', url: url.trim(), platform }
        } else {
          // Instagram: /p/XXXX/ or /reel/XXXX/
          const typeIdx = parts.findIndex(p => p === 'p' || p === 'reel')
          let id = '', author = 'unknown'
          if (typeIdx >= 0 && parts[typeIdx + 1]) id = parts[typeIdx + 1]
          return { id: id || url, author, url: url.trim(), platform }
        }
      } catch {
        return { id: url, author: 'unknown', url: url.trim(), platform }
      }
    }

    const addLinks = () => {
      const lines = linksInput.value.split('\n').map(l => l.trim()).filter(l => /^https?:\/\//.test(l))
      if (!lines.length) {
        alert('请输入至少一个有效的 http(s) 链接')
        return
      }

      const items = currentPlatform.value === 'tiktok' ? tiktokItems : instagramItems
      const existUrls = new Set(items.value.map(i => i.url))
      let added = 0

      for (const line of lines) {
        const info = extractInfo(line, currentPlatform.value)
        if (!existUrls.has(info.url)) {
          items.value.push({ ...info, addedAt: new Date().toISOString() })
          existUrls.add(info.url)
          added++
        }
      }

      saveData()
      linksInput.value = ''
      alert(`已添加 ${added} 个新内容`)
    }

    const removeItem = (url) => {
      if (currentPlatform.value === 'tiktok') {
        tiktokItems.value = tiktokItems.value.filter(i => i.url !== url)
      } else {
        instagramItems.value = instagramItems.value.filter(i => i.url !== url)
      }
      saveData()
    }

    const clearAll = () => {
      if (!confirm('确定要清空当前平台的所有收藏吗?')) return
      if (currentPlatform.value === 'tiktok') {
        tiktokItems.value = []
      } else {
        instagramItems.value = []
      }
      saveData()
    }

    const copyUrl = (url) => {
      navigator.clipboard.writeText(url).then(() => {
        alert('链接已复制到剪贴板')
      })
    }

    const exportJSON = () => {
      const data = {
        tiktok: tiktokItems.value,
        instagram: instagramItems.value,
        summary: summary.value,
        exportedAt: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `social-gems-${Date.now()}.json`
      a.click()
    }

    const saveSummary = async () => {
      try {
        await fetch('/api/social-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: summary.value })
        })
        alert('总结已保存')
      } catch (err) {
        console.error('保存失败:', err)
        alert('保存失败,请重试')
      }
    }

    const saveData = async () => {
      try {
        await fetch('/api/social-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tiktok: tiktokItems.value,
            instagram: instagramItems.value
          })
        })
      } catch (err) {
        console.error('保存失败:', err)
      }
    }

    const loadData = async () => {
      try {
        const res = await fetch('/api/social-items')
        const data = await res.json()
        tiktokItems.value = data.tiktok || []
        instagramItems.value = data.instagram || []
        
        const summaryRes = await fetch('/api/social-summary')
        const summaryData = await summaryRes.json()
        summary.value = summaryData.summary || ''
      } catch (err) {
        console.error('加载失败:', err)
      }
    }

    const formatRelativeTime = (isoString) => {
      if (!isoString) return '暂无'
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return '刚刚'
      if (diffMins < 60) return `${diffMins}分钟前`
      if (diffHours < 24) return `${diffHours}小时前`
      if (diffDays < 7) return `${diffDays}天前`
      return date.toLocaleDateString('zh-CN')
    }

    onMounted(() => {
      loadData()
    })

    return {
      currentPlatform,
      customKeyword,
      linksInput,
      summary,
      currentKeywords,
      currentItems,
      currentAuthors,
      latestAddTime,
      searchCustom,
      addLinks,
      removeItem,
      clearAll,
      copyUrl,
      exportJSON,
      saveSummary,
      formatRelativeTime
    }
  }
}
</script>

<style scoped>
.social-search {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 24px;
}

.header-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.header-subtitle {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.platform-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding: 4px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.platform-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.platform-tab:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.platform-tab.active {
  color: var(--accent-gold);
  background: var(--accent-gold-dim);
}

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.badge {
  padding: 4px 10px;
  background: var(--accent-gold-dim);
  color: var(--accent-gold);
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.keyword-tag {
  padding: 6px 14px;
  background: rgba(212, 165, 116, 0.1);
  color: var(--accent-gold);
  border: 1px solid rgba(212, 165, 116, 0.2);
  border-radius: 16px;
  font-size: 0.85rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.keyword-tag:hover {
  background: rgba(212, 165, 116, 0.2);
  border-color: rgba(212, 165, 116, 0.3);
}

.search-row {
  display: flex;
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--accent-gold);
}

.hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.links-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  margin-bottom: 12px;
}

.links-textarea:focus {
  border-color: var(--accent-gold);
}

.action-row {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-gold), #c8945f);
  color: var(--bg-base);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 165, 116, 0.3);
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.04);
}

.btn-danger {
  background: transparent;
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.5);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent-gold);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.item-card {
  position: relative;
  padding: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: border-color 0.2s;
}

.item-card:hover {
  border-color: var(--border-default);
}

.item-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.item-remove:hover {
  color: var(--error);
  background: rgba(239, 68, 68, 0.1);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-author {
  color: var(--accent-gold);
  font-size: 0.85rem;
  font-weight: 500;
}

.item-platform {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border-radius: 4px;
  font-size: 0.7rem;
}

.item-id {
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  margin-bottom: 10px;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.item-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(212, 165, 116, 0.1);
  color: var(--accent-gold);
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
}

.item-link:hover {
  background: rgba(212, 165, 116, 0.2);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
}

.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.3;
}

.empty-state p {
  font-size: 0.9rem;
}

.summary-textarea {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  margin-bottom: 12px;
}

.summary-textarea:focus {
  border-color: var(--accent-gold);
}
</style>
