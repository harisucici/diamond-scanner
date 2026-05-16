#!/bin/bash

echo "========================================="
echo "🔧 修复 Chat 依赖问题"
echo "========================================="
echo ""

# 1. 检查数据库文件
echo "📦 步骤 1: 检查数据库文件"
if [ -f "db/database.sqlite" ]; then
    SIZE=$(ls -lh db/database.sqlite | awk '{print $5}')
    echo "✅ database.sqlite 存在 ($SIZE)"
else
    echo "❌ database.sqlite 不存在"
    exit 1
fi

if [ -f "db/gemstone.sqlite" ]; then
    SIZE=$(ls -lh db/gemstone.sqlite | awk '{print $5}')
    echo "✅ gemstone.sqlite 存在 ($SIZE)"
else
    echo "❌ gemstone.sqlite 不存在"
fi

echo ""

# 2. 检查数据量
echo "📊 步骤 2: 检查数据量"
TABLES=$(sqlite3 db/database.sqlite "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
echo "   数据表数量: $TABLES"

NECKLACES=$(sqlite3 db/database.sqlite "SELECT COUNT(*) FROM necklaces;" 2>/dev/null || echo "0")
echo "   项链数据: $NECKLACES 条"

EBAY=$(sqlite3 db/database.sqlite "SELECT COUNT(*) FROM ebay_products;" 2>/dev/null || echo "0")
echo "   eBay 数据: $EBAY 条"

echo ""

# 3. 检查 Git 状态
echo "🔍 步骤 3: 检查 Git 状态"
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "✅ Git 仓库存在"
    
    # 检查数据库是否被追踪
    if git ls-files --error-unmatch db/database.sqlite > /dev/null 2>&1; then
        echo "✅ database.sqlite 已被 Git 追踪"
    else
        echo "⚠️  database.sqlite 未被 Git 追踪"
        echo ""
        echo "📝 需要执行以下命令："
        echo "   git add db/database.sqlite"
        echo "   git add db/gemstone.sqlite"
        echo "   git commit -m 'Add database files for chat dependency'"
        echo "   git push"
    fi
else
    echo "❌ 不是 Git 仓库"
fi

echo ""
echo "========================================="
echo "✨ 检查完成"
echo "========================================="
echo ""
echo "📚 解决方案："
echo ""
echo "方案 1: 直接提交数据库（推荐，< 50MB）"
echo "  git add db/*.sqlite"
echo "  git commit -m 'Add database files'"
echo "  git push"
echo "  # 然后在 Render 重新部署"
echo ""
echo "方案 2: 使用 Git LFS（数据库 > 50MB）"
echo "  git lfs install"
echo "  git lfs track '*.sqlite'"
echo "  git add .gitattributes"
echo "  git add db/*.sqlite"
echo "  git commit -m 'Add database via LFS'"
echo "  git push"
echo ""
echo "方案 3: 使用云存储（生产环境推荐）"
echo "  - 上传数据库到 S3/OSS/R2"
echo "  - 启动时从云存储下载"
echo "  - 定期备份到云存储"
echo ""
