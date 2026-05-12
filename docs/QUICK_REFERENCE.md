# Amazon宝石数据源 - 快速参考

## 🚀 快速开始

### 1️⃣ 启动服务器
```bash
cd /Users/harisucici/StudioProjects/diamond-scanner
npm run dev
```

### 2️⃣ 登录系统
- URL: http://localhost:3000
- 用户名: `harisucici`
- 密码: `ppnn13%`

### 3️⃣ 查看数据
1. 进入"📊 配饰排行"页面
2. 点击"📡 数据源"
3. 勾选"💠 Amazon宝石"
4. 点击"🔄"刷新

## 📊 API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/amazon-gemstones` | GET | 获取产品数据 |
| `/api/amazon-gemstones/refresh/:month` | POST | 刷新数据 |
| `/api/amazon-gemstones/months` | GET | 获取月份列表 |
| `/api/gemstone/categories` | GET | 获取品类列表 |

## 💎 品类列表

| ID | 中文名 | 英文名 |
|----|--------|--------|
| `lab_diamond` | 培育钻石 | Lab-Grown Diamond |
| `lab_emerald` | 培育祖母绿 | Lab-Grown Emerald |
| `lab_ruby` | 培育红宝石 | Lab-Grown Ruby |
| `lab_sapphire` | 培育蓝宝石 | Lab-Grown Sapphire |
| `saltwater_pearl` | 海水珍珠 | Saltwater Pearl |
| `freshwater_pearl` | 淡水珍珠 | Freshwater Pearl |

## 🔧 Curl命令

```bash
# 获取品类
curl http://localhost:3000/api/gemstone/categories

# 获取月份
curl http://localhost:3000/api/amazon-gemstones/months

# 获取产品
curl "http://localhost:3000/api/amazon-gemstones?limit=10"

# 刷新数据
curl -X POST http://localhost:3000/api/amazon-gemstones/refresh/2025-01

# 按品类查询
curl "http://localhost:3000/api/amazon-gemstones?category=lab_diamond"
```

## 🗄️ 数据库查询

```sql
-- 查看产品数量
SELECT category_name_zh, COUNT(*) as count 
FROM gemstone_products 
GROUP BY category_id;

-- 查看平均价格
SELECT category_name_zh, AVG(price) as avg_price 
FROM gemstone_products 
GROUP BY category_id;

-- 查看最新产品
SELECT title, price, rating, reviews 
FROM gemstone_products 
ORDER BY timestamp DESC 
LIMIT 10;

-- 按评分排序
SELECT title, rating, reviews, price 
FROM gemstone_products 
WHERE rating > 4.5 
ORDER BY rating DESC;
```

## ⚙️ 配置

`.env` 文件：
```env
RAINFOREST_API_KEY=F2C603C448C54BC086A9275C5DD33B59
```

## 📁 文件位置

```
diamond-scanner/
├── server.js                              # API端点
├── src/pages/NecklaceSales.vue           # 前端页面
├── db/database.sqlite                     # 数据库
├── docs/
│   ├── AMAZON_GEMSTONES_INTEGRATION.md   # 详细文档
│   └── AMAZON_GEMSTONES_SUMMARY.md       # 完成总结
├── test_amazon_gemstones.sh               # API测试脚本
└── verify_integration.sh                  # 集成验证脚本
```

## 🐛 常见问题

### Q: 刷新很慢？
A: 正常，需要调用多次API（约1-2分钟）

### Q: 没有数据？
A: 点击"🔄"按钮刷新数据

### Q: 图片不显示？
A: Amazon可能有防盗链，点击链接查看

### Q: API Key错误？
A: 检查`.env`文件中的`RAINFOREST_API_KEY`

## 🎯 数据字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `productName` | 产品名称 | "Lab Created Diamond..." |
| `brand` | 品牌/卖家 | "Diamond Palace" |
| `price` | 价格 | 299.99 |
| `currency` | 货币 | "USD" |
| `rating` | 评分 | 4.5 |
| `reviews` | 评论数 | 128 |
| `image` | 图片URL | "https://..." |
| `url` | 产品链接 | "https://amazon.com/..." |
| `asin` | 产品ID | "B08XYZ123" |

## ✅ 验证集成

```bash
chmod +x verify_integration.sh
./verify_integration.sh
```

---

**更新时间**: 2025-01-14  
**状态**: ✅ 已完成
