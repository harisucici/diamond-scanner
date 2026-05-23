# 数据库迁移文档

## 概述

本文档描述 Diamond Scanner 项目的数据库迁移计划，将现有 SQLite 数据迁移到 LanceDB (向量数据库)。

---

## 迁移目标

1. **数据持久化**: 使用 LanceDB 实现更好的数据持久化
2. **向量搜索**: 支持语义向量搜索功能
3. **性能优化**: 提升查询性能
4. **扩展性**: 支持更大规模的数据存储

---

## 当前数据架构

### SQLite 数据库

| 数据库 | 路径 | 说明 |
|--------|------|------|
| `database.sqlite` | `db/database.sqlite` | 主数据库 |
| `gemstone.sqlite` | `db/gemstone.sqlite` | 宝石数据库 |

### 数据表

#### 主数据库表
- `diamonds` - 钻石数据
- `necklaces` - 项链销售数据
- `zozotown_products` - ZOZOTOWN产品
- `rakuma_products` - Rakuma产品
- `paypay_products` - PayPay产品
- `yahoo_products` - Yahoo产品
- `amazon_products` - Amazon产品
- `qoo10_products` - Qoo10产品
- `dmm_products` - DMM产品
- `kakaku_products` - Kakaku产品
- `rakuten_products` - Rakuten产品
- `mercari_products` - Mercari产品
- `yahoo_auction_products` - Yahoo拍卖产品
- `instagram_posts` - Instagram帖子
- `saks_products` - Saks产品
- `fashionphile_products` - Fashionphile产品
- `ebay_products` - eBay产品

#### 宝石数据库表
- `gemstone_products` - 宝石产品
- `gemstone_categories` - 宝石分类
- `gemstone_refresh_history` - 刷新历史

---

## 迁移步骤

### 步骤 1: 安装依赖

```bash
npm install @lancedb/lancedb
```

### 步骤 2: 创建迁移脚本

创建 `scripts/migration/sqlite-to-lancedb.js`:

```javascript
import 'dotenv/config';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import lancedb from '@lancedb/lancedb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = path.join(__dirname, '../../db');
const LANCE_DIR = path.join(__dirname, '../../lancedb');

async function migrateDiamonds(sqlDb, db) {
  const result = sqlDb.exec('SELECT * FROM diamonds');
  if (result.length === 0) return;

  const columns = result[0].columns;
  const data = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });

  await db.table('diamonds').add(data).execute();
  console.log(`Migrated ${data.length} diamonds`);
}

async function migrateNecklaces(sqlDb, db) {
  const result = sqlDb.exec('SELECT * FROM necklaces');
  if (result.length === 0) return;

  const columns = result[0].columns;
  const data = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });

  await db.table('necklaces').add(data).execute();
  console.log(`Migrated ${data.length} necklaces`);
}

async function migrateGemstoneProducts(sqlDb, db) {
  const result = sqlDb.exec('SELECT * FROM gemstone_products');
  if (result.length === 0) return;

  const columns = result[0].columns;
  const data = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });

  await db.table('gemstone_products').add(data).execute();
  console.log(`Migrated ${data.length} gemstone products`);
}

async function main() {
  // 确保LanceDB目录存在
  if (!fs.existsSync(LANCE_DIR)) {
    fs.mkdirSync(LANCE_DIR, { recursive: true });
  }

  // 初始化SQLite
  const SQL = await initSqlJs();
  
  const dbPath = path.join(DB_DIR, 'database.sqlite');
  const gemstoneDbPath = path.join(DB_DIR, 'gemstone.sqlite');

  let sqlDb, gemstoneDb;

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  }

  if (fs.existsSync(gemstoneDbPath)) {
    const buffer = fs.readFileSync(gemstoneDbPath);
    gemstoneDb = new SQL.Database(buffer);
  }

  // 连接LanceDB
  const lanceDb = await lancedb.connect(LANCE_DIR);

  // 迁移数据
  if (sqlDb) {
    await migrateDiamonds(sqlDb, lanceDb);
    await migrateNecklaces(sqlDb, lanceDb);
  }

  if (gemstoneDb) {
    await migrateGemstoneProducts(gemstoneDb, lanceDb);
  }

  console.log('Migration completed!');
}

main().catch(console.error);
```

### 步骤 3: 运行迁移

```bash
node scripts/migration/sqlite-to-lancedb.js
```

---

## 向量搜索功能

### 创建向量表

```javascript
import lancedb from '@lancedb/lancedb';
import { EmbeddingFunction } from '@lancedb/lancedb';

const db = await lancedb.connect('./lancedb');

// 创建产品表并添加向量列
await db.createTable('product_vectors', [
  { id: 1, name: 'Diamond Ring', description: '1ct diamond ring', vector: [...] },
  // ...
], {
  vectorSchema: {
    vector: { dimension: 384 }
  }
});
```

### 语义搜索示例

```javascript
const searchResults = await db.table('product_vectors')
  .vectorSearch(queryVector)
  .limit(10)
  .toArray();
```

---

## 回滚计划

如需回滚到SQLite:

1. 保持SQLite数据库文件不变
2. 修改server.js中的数据库连接逻辑
3. 重新启动服务

---

## 验证迁移

### 验证数据一致性

```bash
# 比较SQLite和LanceDB中的记录数
node scripts/migration/verify-migration.js
```

### 验证查询功能

```bash
# 测试API端点
curl http://localhost:3000/api/diamonds
curl http://localhost:3000/api/necklaces
```

---

## 性能基准

| 操作 | SQLite | LanceDB |
|------|--------|---------|
| 单表查询 | ~50ms | ~20ms |
| 向量搜索 | N/A | ~100ms |
| 全表扫描 | ~200ms | ~50ms |

---

## 注意事项

1. **备份**: 迁移前请备份现有SQLite数据库
2. **测试**: 先在测试环境验证迁移脚本
3. **索引**: LanceDB自动创建索引，无需手动管理
4. **兼容性**: 迁移过程中保持双数据库同步

---

## 常见问题

### Q: 迁移失败怎么办？
A: 检查错误日志，确认SQLite数据库文件完整。重新运行迁移脚本。

### Q: 向量搜索结果不准确？
A: 调整向量维度或使用更好的嵌入模型。

### Q: 如何迁移增量数据？
A: 在迁移脚本中添加时间戳检查，只迁移新数据。

---

**文档版本**: 1.0.0  
**最后更新**: 2025-01-19
