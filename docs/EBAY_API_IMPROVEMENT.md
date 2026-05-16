# eBay API 改进指南

## 📋 问题分析

### 当前实现的问题

1. **使用过时的 Finding API**
   - 传统 SOAP/JSON API，速率限制严格
   - 缺少 OAuth 2.0 认证
   - 错误：`10001 - Service call has exceeded the number of times`

2. **缺少速率限制处理**
   - 没有监控 `X-RateLimit-*` 响应头
   - 没有指数退避重试机制
   - 容易触发配额限制

3. **缺少合规功能**
   - 未实现 Marketplace Account Deletion 端点
   - GDPR/CCPA 合规风险

---

## ✅ 改进方案

### 1. 升级到 REST API + OAuth 2.0

#### 优势对比

| 特性 | Finding API (旧) | Browse API (新) |
|------|-----------------|----------------|
| 认证方式 | API Key | OAuth 2.0 |
| 速率限制 | 严格 | 更宽松 |
| 响应格式 | 复杂嵌套 JSON | 简洁 RESTful |
| 功能完整性 | 基础搜索 | 搜索 + 过滤 + 推荐 |
| 维护状态 | 逐步弃用 | 持续更新 |

#### OAuth 2.0 凭证获取

1. 访问 https://developer.ebay.com/my/keys
2. 创建应用或使用现有应用
3. 获取三组凭证：
   - **App ID (Client ID)**: 公开标识符
   - **Cert ID (Client Secret)**: 机密凭证（绝对不要暴露！）
   - **Dev ID**: 用于传统 API

4. 配置到 `.env`:
```bash
EBAY_APP_ID=your-app-id
EBAY_CERT_ID=your-cert-id
EBAY_DEV_ID=your-dev-id
EBAY_ENV=sandbox  # 或 production
```

### 2. 速率限制处理

#### 监控响应头
```
X-RateLimit-Limit: 10000        # 时间窗口允许的最大请求数
X-RateLimit-Remaining: 9845     # 剩余请求数
X-RateLimit-Reset: 1672531200   # 重置时间戳
```

#### 指数退避重试
```javascript
// 429 错误时自动重试
const delay = baseDelay * Math.pow(2, attempt)  // 1s → 2s → 4s → 8s
```

### 3. Marketplace Account Deletion 合规

#### 必须实现的功能

```javascript
// 处理 eBay 发送的用户删除通知
POST /api/ebay/account-deletion
→ 验证签名
→ 提取用户 ID
→ 删除该用户所有数据
→ 返回 200 OK
```

#### 配置步骤

1. 在开发者后台配置端点 URL
2. 实现签名验证逻辑
3. 实现数据清理逻辑
4. 测试验证（eBay 提供模拟通知工具）

---

## 🚀 快速开始

### 步骤 1: 获取 eBay 凭证

#### 沙盒环境（开发测试）
```
https://developer.ebay.com/my/keys
→ 选择应用
→ Sandbox Keys
→ 复制 App ID 和 Cert ID
```

#### 生产环境（正式上线）
```
https://developer.ebay.com/my/keys
→ 选择应用
→ Production Keys
→ 复制 App ID 和 Cert ID
```

### 步骤 2: 配置环境变量

编辑 `.env` 文件：

```bash
# eBay OAuth 2.0 凭证
EBAY_APP_ID=cici-diamond-PRD-818349980-faa6a2e9
EBAY_CERT_ID=your-actual-cert-id-here
EBAY_DEV_ID=your-actual-dev-id-here

# 环境选择
EBAY_ENV=sandbox  # 开发测试用 sandbox，上线用 production
```

### 步骤 3: 测试 API

```bash
# 运行测试脚本
node test-ebay-api.js
```

预期输出：
```
✅ eBay OAuth Token 已获取，有效期: 7200 秒
✅ eBay REST API: 获取 5 条 "diamond necklace" 数据
📊 速率限制: 9995/10000
```

### 步骤 4: 集成到项目

在 `server.js` 中使用改进版 API：

```javascript
import { fetchEbayDataRest } from './ebay-api-improved.js'

// 替换原有的 fetchEbayData
app.post('/api/ebay/refresh/:month', async (req, res) => {
  const { month } = req.params
  const result = await fetchEbayDataRest('jewelry', 50)
  
  // 保存到数据库
  result.items.forEach(item => {
    dbExec(
      'INSERT INTO ebay_products (...) VALUES (...)',
      [...]
    )
  })
  
  res.json({
    success: true,
    count: result.items.length,
    rateLimit: result.rateLimit
  })
})
```

---

## 📊 速率限制策略

### 配额限制

| API | 每日配额 | 每秒限制 |
|-----|---------|---------|
| Browse API | 50,000 | 50 req/s |
| Finding API | 5,000 | 10 req/s |

### 最佳实践

1. **监控剩余配额**
```javascript
if (rateLimiter.remaining < 100) {
  console.warn('⚠️ 配额即将耗尽')
}
```

2. **缓存常用数据**
```javascript
// 类目、站点配置等不常变的数据
cache.set('categories', categories, 3600)  // 缓存 1 小时
```

3. **批量操作**
```javascript
// 使用批量 API 减少调用次数
bulkCreateOrReplaceInventoryItem([item1, item2, ...])
```

---

## 🔒 安全最佳实践

### 机密管理

```bash
# ❌ 错误：硬编码在代码中
const CERT_ID = 'prod-xxx-yyy'

# ✅ 正确：使用环境变量
const CERT_ID = process.env.EBAY_CERT_ID

# ✅ 更好：使用密钥管理服务
const CERT_ID = await awsSecretsManager.getSecret('ebay-cert-id')
```

### 环境隔离

```bash
# 开发环境：使用 Sandbox
EBAY_ENV=sandbox

# 生产环境：使用 Production
EBAY_ENV=production
```

---

## 🧪 测试清单

### 功能测试

- [ ] OAuth Token 获取成功
- [ ] Token 自动刷新（过期前 5 分钟）
- [ ] 商品搜索返回正确数据
- [ ] 速率限制监控正常工作
- [ ] 429 错误自动重试

### 合规测试

- [ ] Account Deletion 端点可访问
- [ ] 签名验证逻辑正确
- [ ] 用户数据完全删除
- [ ] 返回正确的 HTTP 状态码

### 性能测试

- [ ] 连续请求不触发速率限制
- [ ] Token 缓存有效减少认证请求
- [ ] 批量操作减少 API 调用次数

---

## 📚 参考资源

- [eBay Developer Portal](https://developer.ebay.com/)
- [Browse API 文档](https://developer.ebay.com/api-docs/browse/static/overview.html)
- [OAuth 2.0 指南](https://developer.ebay.com/develop/guides/oauth)
- [Marketplace Account Deletion](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion)
- [速率限制最佳实践](https://developer.ebay.com/develop/guides/rate-limits)

---

## ❓ 常见问题

### Q: 为什么 Token 会过期？
A: Access Token 有效期 2 小时，需要自动刷新。我们的实现会在过期前 5 分钟自动获取新 Token。

### Q: 沙盒和生产环境有什么区别？
A: 沙盒环境用于开发测试，数据是模拟的；生产环境是真实的 eBay 数据。**切记：上线前切换到 production！**

### Q: 如何查看配额使用情况？
A: 查看 API 响应头 `X-RateLimit-Remaining`，或在开发者后台查看配额仪表盘。

### Q: 为什么要实现 Account Deletion？
A: GDPR 和 CCPA 法律要求。不实现可能导致应用被暂停权限。

---

## 🎯 下一步

1. ✅ 已创建 `ebay-api-improved.js` - 改进版 API 实现
2. ✅ 已创建 `test-ebay-api.js` - 测试脚本
3. ✅ 已更新 `.env` 配置模板
4. ⏳ 待完成：获取真实的 eBay OAuth 凭证
5. ⏳ 待完成：集成到 `server.js`
6. ⏳ 待完成：实现 Account Deletion 端点

**建议：先在沙盒环境测试通过后，再切换到生产环境。**
