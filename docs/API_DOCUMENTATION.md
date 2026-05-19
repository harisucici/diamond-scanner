# Diamond Scanner API 文档

## 概述

Diamond Scanner 是一个用于扫描和追踪珠宝、钻石、宝石等产品价格的数据采集和分析系统。

**基础URL**: `http://localhost:3000`

---

## 认证

部分端点需要认证。登录后，Session信息会被保存在Cookie中。

**默认账号**:
- 用户名: `harisucici`
- 密码: `ppnn13%`

---

## 通用响应格式

### 成功响应
```json
{
  "status": "success",
  "data": { ... }
}
```

### 错误响应
```json
{
  "status": "error",
  "message": "错误信息"
}
```

---

## API 端点列表

### 1. 健康检查

| 项目 | 说明 |
|------|------|
| **端点** | `/api/health` |
| **方法** | GET |
| **说明** | 检查服务是否正常运行 |

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-19T10:00:00.000Z"
}
```

---

### 2. 钻石管理

#### 2.1 获取所有钻石

| 项目 | 说明 |
|------|------|
| **端点** | `/api/diamonds` |
| **方法** | GET |
| **说明** | 获取所有钻石记录 |

**查询参数**: 无

**响应示例**:
```json
[
  {
    "id": 1,
    "carat": 1.5,
    "color": "D",
    "clarity": "IF",
    "price": 15000,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

#### 2.2 创建钻石

| 项目 | 说明 |
|------|------|
| **端点** | `/api/diamonds` |
| **方法** | POST |
| **说明** | 创建新的钻石记录 |

**请求体**:
```json
{
  "carat": 1.0,
  "color": "E",
  "clarity": "VS1",
  "price": 10000
}
```

**响应示例**:
```json
{
  "id": 5,
  "carat": 1.0,
  "color": "E",
  "clarity": "VS1",
  "price": 10000
}
```

#### 2.3 删除钻石

| 项目 | 说明 |
|------|------|
| **端点** | `/api/diamonds/:id` |
| **方法** | DELETE |
| **说明** | 删除指定ID的钻石记录 |

**路径参数**:
- `id`: 钻石ID

---

### 3. 项链数据

#### 3.1 获取项链列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces` |
| **方法** | GET |
| **说明** | 获取所有项链记录 |

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `month` | string | 月份筛选 (如: 2025-01) |
| `website` | string | 网站筛选 |
| `brand` | string | 品牌筛选 |
| `limit` | number | 限制返回数量 |

**响应示例**:
```json
[
  {
    "id": 1,
    "rank": 1,
    "month": "2025-01",
    "website": "amazon",
    "productName": "Diamond Necklace",
    "brand": "Tiffany",
    "priceRange": "$1000-$2000",
    "sales": 500,
    "url": "https://...",
    "category": "necklace",
    "image": "https://..."
  }
]
```

#### 3.2 获取月份列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/months` |
| **方法** | GET |

#### 3.3 获取网站列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/websites` |
| **方法** | GET |

#### 3.4 获取品牌列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/brands` |
| **方法** | GET |

#### 3.5 获取Top10

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/top10/:month` |
| **方法** | GET |
| **说明** | 获取指定月份的销售Top10 |

#### 3.6 按分类获取

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/category/:month/:category` |
| **方法** | GET |

#### 3.7 刷新数据

| 项目 | 说明 |
|------|------|
| **端点** | `/api/necklaces/refresh/:month` |
| **方法** | POST |
| **说明** | 刷新指定月份的项链数据 |

---

### 4. Instagram数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/instagram` | GET | 获取Instagram帖子 |
| `/api/instagram/months` | GET | 获取月份列表 |
| `/api/instagram/hashtags` | GET | 获取话题标签列表 |
| `/api/instagram/refresh/:month` | POST | 刷新数据 |

---

### 5. Saks数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/saks` | GET | 获取Saks产品 |
| `/api/saks/months` | GET | 获取月份列表 |
| `/api/saks/refresh/:month` | POST | 刷新数据 |

---

### 6. Fashionphile数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/fashionphile` | GET | 获取Fashionphile产品 |
| `/api/fashionphile/months` | GET | 获取月份列表 |
| `/api/fashionphile/brands` | GET | 获取品牌列表 |
| `/api/fashionphile/refresh/:month` | POST | 刷新数据 |

---

### 7. eBay数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ebay` | GET | 获取eBay产品 |
| `/api/ebay/months` | GET | 获取月份列表 |
| `/api/ebay/categories` | GET | 获取分类列表 |
| `/api/ebay/refresh/:month` | POST | 刷新数据 |

---

### 8. Amazon宝石数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/amazon-gemstones` | GET | 获取Amazon宝石产品 |
| `/api/amazon-gemstones/months` | GET | 获取月份列表 |
| `/api/amazon-gemstones/categories` | GET | 获取分类列表 |
| `/api/amazon-gemstones/refresh/:month` | POST | 刷新数据 |

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `month` | string | 月份筛选 |
| `category` | string | 品类筛选 |
| `limit` | number | 限制返回数量 |
| `offset` | number | 偏移量 |

---

### 9. 宝石数据 (内部数据库)

#### 9.1 获取品类列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/categories` |
| **方法** | GET |

**响应示例**:
```json
[
  {
    "id": 1,
    "category_id": "lab_diamond",
    "category_name_zh": "培育钻石",
    "category_name_en": "Lab-Grown Diamond",
    "total_products": 1500,
    "last_updated": "2025-01-19T10:00:00.000Z"
  }
]
```

#### 9.2 获取产品列表

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/products` |
| **方法** | GET |

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `categoryId` | string | 品类ID |
| `limit` | number | 限制数量 |
| `offset` | number | 偏移量 |
| `minPrice` | number | 最低价格 |
| `maxPrice` | number | 最高价格 |
| `minRating` | number | 最低评分 |

#### 9.3 获取报告

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/reports` |
| **方法** | GET |

#### 9.4 获取报告

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/import` |
| **方法** | POST |
| **说明** | 导入外部数据 |

#### 9.5 抓取品类数据

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/fetch/:categoryId` |
| **方法** | POST |
| **说明** | 抓取指定品类的数据 |

#### 9.6 抓取所有品类

| 项目 | 说明 |
|------|------|
| **端点** | `/api/gemstone/fetch-all` |
| **方法** | POST |
| **说明** | 抓取所有品类的数据 |

---

### 10. 产品搜索

| 项目 | 说明 |
|------|------|
| **端点** | `/api/products/search` |
| **方法** | GET |
| **说明** | 向量化搜索产品 |

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `q` | string | 搜索关键词 |
| `limit` | number | 限制数量 |

---

### 11. 数据源状态

| 项目 | 说明 |
|------|------|
| **端点** | `/api/sources/status` |
| **方法** | GET |
| **说明** | 获取所有数据源的状态 |

---

### 12. 聊天API

#### 12.1 通用聊天

| 项目 | 说明 |
|------|------|
| **端点** | `/api/chat` |
| **方法** | POST |

**请求体**:
```json
{
  "message": "推荐一款1克拉的钻石项链",
  "context": {}
}
```

#### 12.2 GLM聊天

| 项目 | 说明 |
|------|------|
| **端点** | `/api/chat/glm` |
| **方法** | POST |

#### 12.3 Groq聊天

| 项目 | 说明 |
|------|------|
| **端点** | `/api/chat/groq` |
| **方法** | POST |

---

## 数据字段说明

### 钻石字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | 唯一标识 |
| `carat` | float | 克拉数 (0.1-50) |
| `color` | string | 颜色 (D-M) |
| `clarity` | string | 净度 (FL-I3) |
| `price` | integer | 价格 (正整数) |
| `created_at` | datetime | 创建时间 |

### 项链字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | 唯一标识 |
| `rank` | integer | 排名 |
| `month` | string | 月份 |
| `website` | string | 网站 |
| `productName` | string | 产品名称 |
| `brand` | string | 品牌 |
| `priceRange` | string | 价格区间 |
| `sales` | integer | 销量 |
| `url` | string | 产品链接 |
| `category` | string | 分类 |
| `image` | string | 图片链接 |

### 宝石产品字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | 唯一标识 |
| `category_id` | string | 品类ID |
| `category_name_zh` | string | 中文品类名 |
| `category_name_en` | string | 英文品类名 |
| `title` | string | 产品标题 |
| `price` | float | 价格 |
| `currency` | string | 货币 |
| `rating` | float | 评分 (0-5) |
| `reviews` | integer | 评论数 |
| `seller` | string | 卖家 |
| `asin` | string | Amazon产品ID |
| `url` | string | 产品链接 |
| `image` | string | 图片链接 |
| `is_prime` | boolean | 是否Prime |
| `is_best_seller` | boolean | 是否畅销品 |

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求错误 |
| 401 | 未认证 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 示例命令

```bash
# 健康检查
curl http://localhost:3000/api/health

# 获取钻石列表
curl http://localhost:3000/api/diamonds

# 创建钻石
curl -X POST http://localhost:3000/api/diamonds \
  -H "Content-Type: application/json" \
  -d '{"carat":1.5,"color":"E","clarity":"VS1","price":12000}'

# 获取项链列表
curl "http://localhost:3000/api/necklaces?month=2025-01&limit=10"

# 获取宝石分类
curl http://localhost:3000/api/gemstone/categories

# 搜索产品
curl "http://localhost:3000/api/products/search?q=diamond+necklace"

# 刷新Amazon宝石数据
curl -X POST http://localhost:3000/api/amazon-gemstones/refresh/2025-01
```

---

## 测试

项目使用 Vitest 进行测试。

```bash
# 安装测试依赖
npm install --save-dev vitest

# 运行测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行测试并生成覆盖率报告
npm run test:coverage
```

---

**文档版本**: 1.0.0  
**最后更新**: 2025-01-19
