#!/bin/bash

# 推送develop分支到GitHub
# 用法：./push-develop.sh <github-username> <repo-name>

echo "🚀 Diamond Scanner - 推送develop分支到GitHub"
echo "=============================================="

if [ $# -lt 2 ]; then
    echo "用法: $0 <github-username> <repo-name>"
    echo "示例: $0 harisucici diamond-scanner"
    echo ""
    echo "或者手动执行:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git"
    echo "  git push -u origin develop"
    exit 1
fi

GITHUB_USER="$1"
REPO_NAME="$2"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "GitHub用户名: $GITHUB_USER"
echo "仓库名称: $REPO_NAME"
echo "仓库URL: $REPO_URL"
echo "推送分支: develop"
echo ""

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "⚠️  当前不在develop分支。切换到develop分支？(y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git checkout develop
        echo "✅ 已切换到develop分支"
    else
        echo "❌ 请在develop分支上运行此脚本"
        exit 1
    fi
fi

# 检查远程仓库
if git remote | grep -q origin; then
    CURRENT_URL=$(git remote get-url origin)
    echo "当前远程仓库: $CURRENT_URL"
    if [ "$CURRENT_URL" != "$REPO_URL" ]; then
        echo "远程仓库URL不匹配。更新为 $REPO_URL？(y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            git remote set-url origin "$REPO_URL"
            echo "✅ 已更新远程仓库URL"
        fi
    fi
else
    echo "添加远程仓库..."
    git remote add origin "$REPO_URL"
    echo "✅ 已添加远程仓库"
fi

echo ""
echo "🔍 检查develop分支状态..."
git status --short

echo ""
echo "是否推送develop分支到GitHub？(y/n)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ 取消推送"
    exit 0
fi

echo ""
echo "🔄 推送develop分支..."
if git push -u origin develop; then
    echo ""
    echo "🎉 develop分支推送成功！"
    echo ""
    echo "✅ 分支: develop"
    echo "🌐 仓库: https://github.com/${GITHUB_USER}/${REPO_NAME}/tree/develop"
    echo "📊 提交: $(git log --oneline -1)"
    echo ""
    echo "📋 分支管理命令:"
    echo "  # 查看所有分支"
    echo "  git branch -a"
    echo ""
    echo "  # 切换回main分支"
    echo "  git checkout main"
    echo ""
    echo "  # 合并develop到main"
    echo "  git checkout main"
    echo "  git merge develop"
    echo ""
    echo "  # 推送main分支"
    echo "  git push origin main"
else
    echo ""
    echo "❌ 推送失败"
    echo ""
    echo "可能的原因:"
    echo "1. 仓库不存在 - 请先在GitHub创建仓库"
    echo "2. 认证失败 - 使用Personal Access Token"
    echo "3. 权限问题 - 检查仓库权限"
    echo ""
    echo "手动推送命令:"
    echo "  git push -u origin develop"
    exit 1
fi

echo ""
echo "💎 develop分支推送完成！"