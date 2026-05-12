# 💎 Diamond Scanner

日本配饰销量排行数据平台 - 多数据源聚合分析

## 📊 功能特性

- **多数据源支持**: BUYMA、Fashionphile、Amazon宝石
- **实时数据刷新**: 支持手动和自动刷新
- **智能分类**: 按品类、品牌、价格筛选
- **数据可视化**: 销量排行、趋势图表
- **AI助手**: 智能问答和数据分析
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
│   │   └── JewelryAgent.vue  # AI助手组件
│   ├── services/             # 服务层
│   │   ├── chatService.js    # AI对话服务
│   │   └── gemstoneFetcher.js # 宝石数据获取
│   └── config/               # 配置文件
│       └── chat.js           # AI配置
├── config/                   # 后端配置
│   ├── chat-prompt.yaml      # AI提示词配置
│   └── gemstone_categories.yaml # 宝石品类配置
├── db/                       # 数据库目录
│   ├── database.sqlite       # 主数据库
│   └── gemstone.sqlite       # 宝石数据库
├── server.js                 # 后端服务 (Express)
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件:

```env
# AI服务 (二选一)
GROQ_API_KEY=your_groq_key
GLM_API_KEY=your_zhipu_key
CHAT_API_PROVIDER=glm

# Amazon数据API
RAINFOREST_API_KEY=your_rainforest_key

# 服务配置
PORT=3000
NODE_ENV=development
```

### 3. 启动服务

**开发模式** (前后端分离):

```bash
# 终端1: 启动后端
node server.js

# 终端2: 启动前端
npm run dev
```

**生产模式**:

```bash
npm run build
NODE_ENV=production node server.js
```

### 4. 访问应用

- 前端页面: http://localhost:5173
- 后端API: http://localhost:3000
- 配饰排行: http://localhost:5173/#/necklace-sales

### 登录信息

- 用户名: `harisucici`
- 密码: `ppnn13%`

## 📡 数据源

| 数据源 | 状态 | 说明 |
|--------|------|------|
| 🛍️ BUYMA | ✅ 正常 | 日本配饰销量排行 |
| 💎 Fashionphile | ✅ 正常 | 奢侈品配饰数据 |
| 💠 Amazon宝石 | ⚠️ 需配置 | 需要Rainforest API Key |

## 🔧 常用命令

```bash
# 开发模式
node server.js          # 启动后端 (端口3000)
npm run dev             # 启动前端 (端口5173)

# 生产模式
npm run build           # 构建前端
NODE_ENV=production node server.js  # 启动服务

# 查看数据库
sqlite3 db/database.sqlite "SELECT COUNT(*) FROM jewelry_sales;"
```

## 📝 API端点

- `GET /api/health` - 健康检查
- `GET /api/jewelry-sales` - 获取配饰销量数据
- `POST /api/jewelry-sales/refresh` - 刷新数据
- `GET /api/gemstone/categories` - 获取宝石品类
- `POST /api/amazon-gemstones/refresh/:month` - 刷新Amazon宝石数据

## 🛠️ 技术栈

- **前端**: Vue.js 3 + Vite + Element Plus
- **后端**: Express.js + better-sqlite3
- **数据库**: SQLite
- **AI**: Groq API / 智谱GLM
- **部署**: Render.com

## 📄 License

MIT
