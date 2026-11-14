# 社交平台宝石检索功能

## 功能概述

在 Diamond Scanner 项目中新增了**社交平台宝石检索**模块,支持 TikTok 和 Instagram 两个平台的彩色宝石视频和内容收藏管理。

## 主要特性

### 1. 双平台支持
- **TikTok**: 搜索和收藏彩色宝石相关视频
- **Instagram**: 搜索和收藏宝石相关帖子和 Reels

### 2. 预设关键词
#### TikTok 关键词 (12个)
- 彩色宝石、红宝石、蓝宝石、祖母绿
- 帕拉伊巴碧玺、尖晶石、沙弗莱
- 矿石开采、泰国宝石、斯里兰卡宝石
- 宝石切割、珠宝收藏

#### Instagram 标签 (12个)
- #coloredgemstones、#ruby、#sapphire、#emerald
- #paraibatourmaline、#spinel、#tsavorite
- #gemstonemining、#thaigemstones、#gemstonecutting
- #jewelrycollection、#gemstone

### 3. 核心功能
- ✅ 快速搜索:点击关键词标签直接跳转平台搜索页
- ✅ 自定义搜索:输入任意关键词进行搜索
- ✅ 批量添加:支持一次粘贴多个链接(每行一个)
- ✅ 智能解析:自动提取作者、视频ID等信息
- ✅ 去重检查:自动过滤重复链接
- ✅ 数据持久化:所有收藏保存在 LanceDB 数据库
- ✅ 统计概览:显示收藏数量、创作者数量、最近添加时间
- ✅ 导出功能:一键导出 JSON 格式数据
- ✅ 内容总结:独立区域记录观察和分析

### 4. 界面设计
- 完全遵循项目现有的深色主题 + 金色点缀设计语言
- 响应式布局,支持网格和列表视图
- 流畅的交互动画和视觉反馈
- 中文界面,符合用户习惯

## 技术实现

### 前端
- **文件**: `src/pages/SocialSearch.vue`
- **框架**: Vue 3 Composition API
- **样式**: 使用项目 CSS 变量,保持视觉一致性
- **功能**: 平台切换、关键词搜索、链接解析、数据管理

### 后端
- **文件**: `server.js` (新增 API 端点)
- **API 端点**:
  - `GET /api/social-items` - 获取所有收藏
  - `POST /api/social-items` - 保存收藏数据
  - `GET /api/social-summary` - 获取总结
  - `POST /api/social-summary` - 保存总结
- **数据库**: LanceDB (新增 3 个表)
  - `social_tiktok` - TikTok 视频收藏
  - `social_instagram` - Instagram 内容收藏
  - `social_summary` - 内容总结

### 数据库表结构
```javascript
// social_tiktok / social_instagram
{
  id: string,
  url: string,
  author: string,
  platform: string,
  addedAt: string (ISO timestamp)
}

// social_summary
{
  id: string,
  content: string,
  updated_at: string (ISO timestamp)
}
```

## 使用方法

### 1. 启动项目
```bash
cd diamond-scanner
npm install
npm run dev  # 开发模式
# 或
npm start    # 生产模式
```

### 2. 访问功能
1. 打开浏览器访问 `http://localhost:5173` (开发) 或 `http://localhost:3000` (生产)
2. 登录后点击顶部导航栏的**"社交检索"**标签
3. 选择平台 (TikTok 或 Instagram)
4. 点击预设关键词或输入自定义关键词搜索
5. 复制视频/帖子链接,粘贴到输入框
6. 点击"添加"按钮保存

### 3. 管理收藏
- 查看统计信息(总数、创作者数、最近添加)
- 点击"打开"在新标签页查看原内容
- 点击"复制"复制链接到剪贴板
- 点击"×"删除单条收藏
- 点击"清空全部"删除所有收藏
- 点击"导出 JSON"下载数据文件

### 4. 撰写总结
在"内容总结"区域记录:
- 观察到的趋势
- 热门创作者
- 值得关注的宝石品类
- 市场洞察

## 文件清单

### 新增文件
- `src/pages/SocialSearch.vue` - 前端页面组件 (22.7 KB)

### 修改文件
- `src/App.vue` - 添加导航标签和组件注册
- `server.js` - 添加 4 个 API 端点 (约 150 行代码)

### 数据库表 (自动创建)
- `social_tiktok`
- `social_instagram`
- `social_summary`

## 设计亮点

1. **视觉一致性**: 完全复用项目的设计系统(CSS 变量、颜色、间距)
2. **用户体验**: 
   - 平台切换流畅
   - 实时统计反馈
   - 批量操作支持
   - 智能链接解析
3. **数据持久化**: 使用 LanceDB 存储,与项目其他功能保持一致
4. **可扩展性**: 易于添加新平台或新功能
5. **性能优化**: 
   - 组件懒加载
   - 数据本地缓存
   - 批量操作减少 API 调用

## 后续优化建议

1. **自动抓取**: 实现平台 API 集成,自动获取视频元数据(播放量、点赞数等)
2. **标签分类**: 支持为收藏内容添加自定义标签
3. **搜索过滤**: 在收藏列表中支持关键词搜索
4. **分享功能**: 生成可分享的收藏清单
5. **数据分析**: 统计不同宝石品类的热度趋势
6. **移动端优化**: 改进小屏幕下的交互体验

## 注意事项

- TikTok 和 Instagram 的链接格式需要正确才能解析
- 数据保存在本地 LanceDB 数据库中
- 导出功能会包含所有平台的数据
- 清空操作不可恢复,请谨慎使用

---

**开发完成时间**: 2026-01-14  
**版本**: v1.0  
**状态**: ✅ 已完成并测试通过
