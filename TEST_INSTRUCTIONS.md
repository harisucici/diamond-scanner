# 💎 Diamond Scanner - 测试说明

## 项目已成功创建！

### 📁 项目结构
```
diamond-scanner/
├── src/                    # Vue.js 前端源代码
│   ├── App.vue            # 主组件（包含Hello World页面）
│   └── main.js            # Vue入口文件
├── db/                    # SQLite数据库目录
├── server.js             # Express.js后端API服务器
├── package.json          # 依赖和脚本
├── vite.config.js        # Vite构建配置
├── render.yaml           # Render部署配置
├── start-local.sh        # 本地启动脚本
└── README.md             # 项目文档
```

### 🚀 如何本地运行

#### 方法1：开发模式（热重载）
```bash
# 在一个终端启动后端服务器
npm start

# 在另一个终端启动前端开发服务器
npm run dev
```

#### 方法2：使用启动脚本
```bash
chmod +x start-local.sh
./start-local.sh
```

### 🌐 访问地址
- **前端**: http://localhost:5173
- **后端API**: http://localhost:3000

### 📊 功能特点
1. ✅ **Hello World页面** - 显示欢迎信息
2. ✅ **SQLite数据库集成** - 数据持久化
3. ✅ **API接口** - RESTful API用于数据操作
4. ✅ **响应式设计** - 适配桌面和移动端
5. ✅ **实时数据库状态** - 显示连接状态和数据量
6. ✅ **示例数据** - 可以添加和查看钻石记录

### 🧪 API端点
- `GET /api/health` - 健康检查
- `GET /api/diamonds` - 获取所有钻石记录
- `POST /api/diamonds` - 添加新钻石记录
- `GET /api/test` - API测试

### 🚢 部署到Render

#### 步骤1：推送到Git仓库
```bash
git init
git add .
git commit -m "Initial commit: Diamond Scanner"
git remote add origin <your-repo-url>
git push -u origin main
```

#### 步骤2：在Render部署
1. 访问 https://render.com
2. 点击"New +" → "Web Service"
3. 连接你的Git仓库
4. 自动检测 `render.yaml` 配置
5. 点击"Create Web Service"

#### 或者手动配置：
- **环境**: Node
- **构建命令**: `npm install && npm run build`
- **启动命令**: `npm start`
- **环境变量**: 
  - `NODE_ENV=production`
  - `PORT=3000`

### 🔧 技术栈
- **前端**: Vue.js 3 + Vite
- **后端**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **样式**: 纯CSS，响应式设计
- **部署**: Render.com

### 🎯 下一步
1. 在本地运行测试项目功能
2. 将代码推送到Git仓库
3. 部署到Render.com
4. 测试生产环境API连接

### 📝 注意事项
- 本地运行时确保端口5173和3000可用
- 数据库文件存储在 `db/diamonds.db`
- 首次运行会自动创建数据库和示例数据
- Render部署时会使用生产构建