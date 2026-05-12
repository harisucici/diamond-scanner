# Amazon宝石数据源集成说明

## 功能概述

已将Amazon宝石数据（通过Rainforest API获取）集成到diamond-scanner项目中，作为第三个数据源，与BUYMA和Fashionphile并列显示。

## 数据源列表

现在系统支持3个数据源：

1. **🛍️ BUYMA** - 日本配饰销量排行
2. **💎 Fashionphile** - 奢侈品配饰
3. **💠 Amazon宝石** - Amazon宝石产品数据（新增）

## 数据库结构

### gemstone_products 表

```sql
CREATE TABLE gemstone_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT,              -- 品类ID (lab_diamond, lab_emerald等)
  category_name_zh TEXT,         -- 品类中文名
  category_name_en TEXT,         -- 品类英文名
  keyword TEXT,                  -- 搜索关键词
  platform TEXT,                 -- 平台 (Amazon, Amazon Japan)
  title TEXT,                    -- 产品标题
  price REAL,                    -- 价格
  currency TEXT,                 -- 货币 (USD, JPY)
  rating REAL,                   -- 评分
  reviews INTEGER,               -- 评论数
  seller TEXT,                   -- 卖家名称
  seller_location TEXT,          -- 卖家位置
  country TEXT,                  -- 国家
  asin TEXT UNIQUE,              -- Amazon ASIN (唯一标识)
  url TEXT,                      -- 产品链接
  image TEXT,                    -- 产品图片
  is_prime INTEGER,              -- 是否Prime
  is_best_seller INTEGER,        -- 是否畅销
  timestamp TEXT,                -- 时间戳
  created_at TEXT                -- 创建时间
)
```

## 支持的宝石品类

| 品类ID | 中文名 | 英文名 | 图标 |
|--------|--------|--------|------|
| lab_diamond | 培育钻石 | Lab-Grown Diamond | 💎 |
| lab_emerald | 培育祖母绿 | Lab-Grown Emerald | 💚 |
| lab_ruby | 培育红宝石 | Lab-Grown Ruby | ❤️ |
| lab_sapphire | 培育蓝宝石 | Lab-Grown Sapphire | 💙 |
| saltwater_pearl | 海水珍珠 | Saltwater Pearl | 🤍 |
| freshwater_pearl | 淡水珍珠 | Freshwater Pearl | 🦪 |

## API端点

### 1. 获取宝石产品数据
```
GET /api/amazon-gemstones?month=2025-01&category=lab_diamond&limit=100
```

参数：
- `month`: 月份（可选，格式：YYYY-MM）
- `category`: 品类ID（可选）
- `limit`: 返回数量限制（默认100）

### 2. 刷新宝石数据
```
POST /api/amazon-gemstones/refresh/:month
```

从Rainforest API抓取最新宝石数据并保存到数据库。

响应示例：
```json
{
  "success": true,
  "count": 150,
  "total": 200,
  "items": [...]
}
```

### 3. 获取可用月份
```
GET /api/amazon-gemstones/months
```

返回有数据的月份列表。

## 前端使用

### 在配饰排行页面查看

1. 登录系统（用户名：harisucici，密码：ppnn13%）
2. 进入"📊 配饰排行"页面
3. 点击"📡 数据源"按钮
4. 勾选"💠 Amazon宝石"数据源
5. 点击"🔄"按钮刷新数据

### 数据显示

- 产品名称显示Amazon标题
- 品牌显示卖家名称
- 价格显示USD价格
- 销量显示评论数（作为参考）
- 支持图片展示

## 刷新数据

### 方式一：前端手动刷新

1. 在配饰排行页面点击"🔄"按钮
2. 系统会自动调用Rainforest API抓取所有品类数据
3. 抓取完成后自动刷新页面显示

### 方式二：API调用

```bash
curl -X POST http://localhost:3000/api/amazon-gemstones/refresh/2025-01
```

### 刷新策略

- **BUYMA**: 使用选中的月份
- **Fashionphile**: 使用当前月份
- **Amazon宝石**: 使用当前月份

## 数据抓取逻辑

每次刷新会：

1. 遍历所有6个宝石品类
2. 每个品类使用前3个关键词搜索
3. 每个关键词抓取第1页结果（约10-15个产品）
4. 去重（基于ASIN）
5. 保存到数据库

**预计每次刷新获取**：约100-200个产品

## 配置要求

### 环境变量

确保`.env`文件中已配置：

```env
RAINFOREST_API_KEY=your_api_key_here
```

### 获取API Key

1. 访问 https://www.rainforestapi.com/
2. 注册账号
3. 获取API Key
4. 配置到`.env`文件

## 性能优化

为避免API调用过快：

- 关键词之间间隔：500ms
- 品类之间间隔：1000ms
- 限制关键词数量：每个品类最多3个

## 故障排除

### 1. 数据未显示

检查：
- RAINFOREST_API_KEY是否配置
- API Key是否有效
- 数据库表是否创建

### 2. 刷新失败

查看调试面板：
- 点击"🔧"按钮查看详细日志
- 检查API返回的错误信息

### 3. 图片不显示

- Amazon图片可能有防盗链
- 可以在浏览器中直接打开图片URL测试

## 数据分析

可在前端查看：

- 各品类产品数量
- 平均价格
- 平均评分
- Top产品排行

## 未来扩展

可以考虑添加：

- [ ] 按品类筛选
- [ ] 价格趋势分析
- [ ] 评分对比
- [ ] 卖家分布统计
- [ ] 国家分布统计
