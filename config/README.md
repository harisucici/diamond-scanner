# 配置文件说明

本项目使用 YAML 配置文件管理应用配置，支持环境变量覆盖。

## 配置文件结构

```
config/
├── app.yaml          # 应用基础配置（端口、数据库、eBay等）
├── api.yaml          # AI API 配置（GLM、GROQ等）
├── platforms.yaml    # 平台 URL 模板配置
├── index.js          # 配置加载器
└── chat-prompt.yaml  # 聊天提示词配置（已有）
```

## 配置项说明

### app.yaml - 应用基础配置

| 配置项 | 说明 | 环境变量覆盖 |
|--------|------|-------------|
| `app.port` | 服务端口 | `PORT` |
| `app.proxy_url` | HTTP 代理地址 | `HTTP_PROXY` / `http_proxy` |
| `database.lancedb_dir` | LanceDB 数据目录 | `LANCEDB_DIR` |
| `ebay.env` | eBay 环境 (production/sandbox) | `EBAY_ENV` |
| `ebay.app_id` | eBay App ID | `EBAY_APP_ID` / `EBAY_API_KEY` |
| `ebay.cert_id` | eBay Cert ID | `EBAY_CERT_ID` |
| `chat.default_provider` | 默认 AI 提供者 | `CHAT_API_PROVIDER` |
| `chat.max_tokens` | AI 响应最大 token 数 | - |

### api.yaml - AI API 配置

| 配置项 | 说明 |
|--------|------|
| `providers.glm.url` | GLM API 地址 |
| `providers.glm.model` | GLM 模型名称 |
| `providers.groq.url` | GROQ API 地址 |
| `providers.groq.model` | GROQ 模型名称 |
| `embedding.model` | Embedding 模型名称 |
| `embedding.dimensions` | Embedding 向量维度 |

### platforms.yaml - 平台 URL 模板

定义各平台的 URL 生成规则，使用 `{参数名}` 作为占位符。

示例：
```yaml
platforms:
  buyma:
    name: "BUYMA"
    url_template: "https://www.buyma.com/item/{id}/"
```

## 使用方式

### 在代码中导入配置

```javascript
import * as config from './config/index.js'

// 应用配置
const port = config.app.port
const proxyUrl = config.app.proxyUrl

// 数据库配置
const dbDir = config.database.lancedbDir

// eBay 配置
const ebayAppId = config.ebay.appId

// AI 配置
const provider = config.chat.defaultProvider
const providerConfig = config.getApiProviderConfig('glm')

// 平台 URL
const url = config.getPlatformUrl('buyma', { id: '12345' })
```

### 环境变量优先级

配置加载顺序：
1. 环境变量（最高优先级）
2. 配置文件值
3. 默认值（最低优先级）

## 修改配置

1. **修改配置文件**：直接编辑 `config/*.yaml` 文件
2. **使用环境变量**：在 `.env` 文件或启动命令中设置
3. **重启服务**：配置修改后需要重启服务生效

```bash
# 通过环境变量修改
PORT=8080 node server.js

# 或在 .env 文件中
PORT=8080
CHAT_API_PROVIDER=groq
```
