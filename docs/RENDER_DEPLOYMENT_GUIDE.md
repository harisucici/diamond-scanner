# Render 持久化存储修复 - 部署验证指南

## ✅ 已完成的修改

### 1. 配置持久化存储 (render.yaml)
```yaml
disk:
  name: diamond-data
  mountPath: /opt/render/project/data
  sizeGB: 1
```

### 2. 数据库路径逻辑 (server.js)
- 使用 DATA_DIR 环境变量
- 自动从 Git 仓库复制数据库到持久化存储
- 每次部署不会丢失数据

### 3. Git 提交内容
- ✅ db/gemstone.sqlite (新增)
- ✅ render.yaml (配置持久化存储)
- ✅ server.js (数据库路径逻辑)
- ✅ .gitignore (允许数据库文件)

---

## 📝 接下来的步骤

### 步骤 1: 等待 Render 部署

Render 会自动检测到推送并开始部署（约 2-5 分钟）

**查看部署状态：**
1. 访问 https://dashboard.render.com
2. 找到 `diamond-scanner` 服务
3. 查看 "Events" 标签页
4. 等待状态变为 "Live"

**部署日志应显示：**
```
📁 数据目录: /opt/render/project/data
📄 数据库路径: /opt/render/project/data/database.sqlite
✅ 创建数据目录: /opt/render/project/data
✅ 复制 database.sqlite 到持久化存储
✅ 复制 gemstone.sqlite 到持久化存储
```

### 步骤 2: 验证修复

**测试 Chat API：**

```bash
# 替换为你的 Render URL
curl -X POST https://diamond-scanner.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "推荐一些项链"}
    ]
  }'
```

**预期返回：**
```json
{
  "success": true,
  "reply": "根据您的需求，我为您推荐以下产品：\n1. Tiffany 钻石项链...",
  "products": [
    {
      "brand": "Tiffany",
      "productName": "钻石项链",
      "price": "$299",
      "source": "necklaces"
    }
  ]
}
```

### 步骤 3: 验证数据持久化

**添加测试数据：**
```bash
# 添加 eBay 数据
curl -X POST https://diamond-scanner.onrender.com/api/ebay/refresh/2025-05
```

**等待 1-2 分钟后重新部署：**
```bash
# 触发重新部署（在 Render Dashboard 点击 "Manual Deploy"）
```

**检查数据是否还在：**
```bash
curl https://diamond-scanner.onrender.com/api/ebay?month=2025-05&limit=5
```

**如果返回数据，说明持久化成功！✅**

---

## 🔍 如果遇到问题

### 问题 1: Render 部署失败

**检查日志：**
```
Render Dashboard → diamond-scanner → Logs
```

**可能的原因：**
- render.yaml 格式错误
- 缺少必要的环境变量

### 问题 2: 数据库仍然为空

**检查持久化存储是否挂载：**
```
Render Dashboard → diamond-scanner → Disks
```

应该看到 `diamond-data` 磁盘

### 问题 3: Chat 仍然无法推荐产品

**检查数据库内容：**
```bash
# 通过 API 检查
curl https://diamond-scanner.onrender.com/api/necklaces?month=2025-05

# 应该返回产品数据
```

---

## 📊 部署后监控

### Render Dashboard 指标

**关注以下指标：**
- **Disk Usage**: 应该 > 0 KB（表示数据已存储）
- **Memory Usage**: 应该稳定
- **Response Time**: API 响应时间

### 日志关键词

**正常日志：**
```
✅ 创建数据目录
✅ 复制 database.sqlite 到持久化存储
✅ 复制 gemstone.sqlite 到持久化存储
Server running on port 3000
```

**异常日志：**
```
❌ Could not save database
❌ Database not found
❌ Empty result from searchAllProducts
```

---

## 🎯 最终验证清单

- [ ] Render 部署成功（状态: Live）
- [ ] 日志显示数据库复制成功
- [ ] Chat API 返回产品推荐
- [ ] 数据在重新部署后仍然存在
- [ ] Disk Usage > 0 KB

---

## 📞 获取帮助

**Render 文档：**
- https://render.com/docs/disks
- https://render.com/docsyaml

**项目文档：**
- `docs/RENDER_DATABASE_ISSUE.md` - 完整问题分析
- `docs/CHAT_FIX_REPORT.md` - 修复方案说明

---

**预计完成时间：5-10 分钟**

部署完成后，Render 线上 AI 将能够：
✅ 推荐产品（基于数据库）
✅ 数据持久化（重新部署不丢失）
✅ 无需本地服务即可正常工作
