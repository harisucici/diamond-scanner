#!/bin/bash

# Diamond Scanner - Push to GitHub Script
# 用法：./push-to-github.sh <github-username> <repo-name>

set -e  # 出错时退出

echo "💎 Diamond Scanner - GitHub推送助手"
echo "======================================"

# 检查参数
if [ $# -lt 2 ]; then
    echo "用法: $0 <github-username> <repo-name>"
    echo "示例: $0 harisucici diamond-scanner"
    echo ""
    echo "或者手动执行:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git"
    echo "  git push -u origin main"
    exit 1
fi

GITHUB_USER="$1"
REPO_NAME="$2"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "GitHub用户名: $GITHUB_USER"
echo "仓库名称: $REPO_NAME"
echo "仓库URL: $REPO_URL"
echo ""

# 检查当前目录
if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    echo "错误: 请在diamond-scanner项目目录中运行此脚本"
    echo "当前目录: $(pwd)"
    exit 1
fi

# 检查Git状态
echo "🔍 检查Git状态..."
if [ ! -d ".git" ]; then
    echo "错误: 当前目录不是Git仓库"
    exit 1
fi

git status --short
echo ""

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  发现未提交的更改。是否要提交？(y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "请输入提交信息（默认: Update diamond scanner）:"
        read -r commit_msg
        commit_msg=${commit_msg:-"Update diamond scanner"}
        git add .
        git commit -m "$commit_msg"
        echo "✅ 已提交更改"
    else
        echo "❌ 取消推送。请先提交或暂存更改。"
        exit 1
    fi
fi

# 检查远程仓库配置
echo "🔧 配置远程仓库..."
if git remote | grep -q origin; then
    echo "已存在远程仓库 'origin'。是否要更新？(y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git remote remove origin
        git remote add origin "$REPO_URL"
        echo "✅ 已更新远程仓库"
    else
        echo "使用现有远程仓库"
    fi
else
    git remote add origin "$REPO_URL"
    echo "✅ 已添加远程仓库"
fi

echo ""

# 显示远程仓库信息
echo "📡 远程仓库配置:"
git remote -v
echo ""

# 确认推送
echo "🚀 准备推送到 GitHub"
echo "仓库: $REPO_URL"
echo "分支: main"
echo ""
echo "是否继续？(y/n)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ 取消推送"
    exit 0
fi

echo ""

# 执行推送
echo "🔄 推送代码到GitHub..."
if git push -u origin main; then
    echo ""
    echo "🎉 推送成功！"
    echo ""
    echo "✅ 项目已推送到GitHub"
    echo "🌐 访问地址: https://github.com/${GITHUB_USER}/${REPO_NAME}"
    echo ""
    echo "下一步："
    echo "1. 验证GitHub仓库内容"
    echo "2. 部署到Render.com"
    echo "3. 测试生产环境"
else
    echo ""
    echo "❌ 推送失败"
    echo ""
    echo "可能的原因:"
    echo "1. 仓库不存在 - 请先在GitHub创建仓库"
    echo "2. 认证失败 - 使用Personal Access Token作为密码"
    echo "3. 网络问题 - 检查网络连接"
    echo ""
    echo "手动推送命令:"
    echo "  git push -u origin main"
    exit 1
fi

echo ""
echo "📋 快速验证命令:"
echo "  # 查看提交历史"
echo "  git log --oneline -5"
echo ""
echo "  # 查看远程仓库"
echo "  git remote -v"
echo ""
echo "  # 拉取更新"
echo "  git pull origin main"
echo ""
echo "💎 Diamond Scanner 推送完成！"