# 💎 Diamond Scanner

2日本配饰销量排行数据平台 - 多数据源聚合分析 + AI向量搜索

## 📊 功能特性

- **多数据源支持**: BUYMA、Fashionphile、eBay、Amazon宝石等 16+ 平台
- **实时数据刷新**: 支持手动和自动刷新
- **智能分类**: 按品类、品牌、价格筛选
- **数据可视化**: 销量排行、趋势图表
- **AI助手**: 智能问答和数据分析 (GROQ)
- **🔍 语义搜索**: 基于向量相似度的智能产品搜索
- **🎯 相似推荐**: AI 驱动的相似产品推荐
- **💡 智能推荐**: 基于偏好筛选的个性化推荐
- **用户认证**: 安全的登录系统

## 🏗️ 项目结构

```
diamond-scanner/
├── src/                       # 前端源码
│   ├── App.vue               # 主应用组件
│   ├── main.js               # 入口文件
│   ├── pages/                # 页面组件
│   │   ├── LoginPage.vue     # 登录页
│   │   ├── NecklaceSales.vue # 配饰排行页
│   │   └── GemstoneFetcher.vue # 宝石数据页
│   ├── components/           # 公共组件
│   │   ├── JewelryAgent.vue  # AI助手组件
│   │   └── SemanticSearch.vue # 语义搜索组件
│   ├── services/             # 服务层
│   │   ├── chatService.js    # AI对话服务
│   │   └── gemstoneFetcher.js # 宝石数据获取
│   └── config/               # 配置文件
│       └── chat.js           # AI配置
├── config/                   # 后端配置
│   ├── chat-prompt.yaml      # AI提示词配置
│   └── gemstone_categories.yaml # 宝石品类配置
├── db/                       # 数据库模块
│   └── lancedb.js            # LanceDB 连接管理
├── services/                 # 后端服务
│   └── embeddingService.js   # 向量生成服务
├── routes/                   # API 路由
│   └── lancedbRoutes.js      # LanceDB API 路由
├── lancedb/                  # LanceDB 数据存储
├── scripts/                  # 工具脚本
│   ├── init-lancedb.js       # 初始化脚本
│   └── migrate-to-lancedb.js # 数据迁移脚本
├── server.js                 # 后端服务 (Express)
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# .env 文件
GROQ_API_KEY=your_groq_api_key    # 可选，用于高质量向量生成
PORT=3000                          # 服务端口
```

### 3. 初始化 LanceDB

```bash
npm run init-lancedb
```

### 4. 启动服务

```bash
npm start
```

## 📌 API 端点

### 传统 API
- `GET /api/health` - 健康检查
- `GET /api/necklaces` - 配饰排行数据
- `GET /api/ebay` - eBay 产品数据
- `GET /api/fashionphile` - Fashionphile 产品数据

### 🔍 LanceDB 向量搜索 API
- `POST /api/lancedb/search/semantic` - 语义搜索
  ```json
  { "query": "经典品牌项链", "limit": 10, "platform": "ebay" }
  ```
- `GET /api/lancedb/products/:id/similar` - 相似产品推荐
- `POST /api/lancedb/products/recommend` - 智能推荐
  ```json
  { "preferences": { "brands": ["Tiffany"], "priceRange": [100, 5000] }, "limit": 10 }
  ```
- `GET /api/lancedb/stats` - 数据库统计
- `GET /api/lancedb/products` - 产品列表 (分页)

### AI 对话 API
- `POST /api/chat/groq` - GROQ AI 对话
- `POST /api/chat/glm` - GLM AI 对话

## 🔧 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 向量数据库 | LanceDB | 高性能向量搜索 |
| 嵌入模型 | GROQ / nomic-embed-text-v1.5 | 文本向量化 |
| 后端 | Express.js | API 服务 |
| 前端 | Vue 3 + Vite | 用户界面 |
| AI | GROQ API | 智能对话与推荐 |

## 📊 数据库设计

### LanceDB 表结构

| 表名 | 说明 | 记录数 |
|------|------|--------|
| products_vectors | 统一产品向量表 (16+平台) | 360+ |
| gemstone_vectors | 宝石产品向量表 | - |
| search_history | 搜索历史记录 | - |

### 产品向量字段
- `id`, `table_source`, `product_name`, `brand`, `price`
- `currency`, `category`, `platform`, `url`, `image_url`
- `name_vector` (384维), `search_text`, `metadata`

## 🔄 数据迁移

从 SQLite 迁移到 LanceDB 已完成：
```bash
node scripts/migrate-to-lancedb.js
```

迁移统计：360+ 条产品数据，涵盖 necklaces、ebay、fashionphile 等 16+ 平台。

## 📄 License

MIT
