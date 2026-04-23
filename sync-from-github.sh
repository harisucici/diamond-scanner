#!/bin/bash

# sync-from-github.sh
# 从GitHub同步Diamond Scanner到本地

echo "💎 Diamond Scanner - GitHub同步助手"
echo "======================================"

# 检查是否在正确的目录
if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    echo "❌ 错误: 请在diamond-scanner项目目录中运行此脚本"
    echo "当前目录: $(pwd)"
    echo "请运行: cd ~/.openclaw/workspace/diamond-scanner"
    exit 1
fi

# 检查Git仓库
if [ ! -d ".git" ]; then
    echo "❌ 错误: 当前目录不是Git仓库"
    echo ""
    echo "🔄 正在克隆仓库到新目录..."
    cd ..
    if [ -d "diamond-scanner-fresh" ]; then
        echo "⚠️  diamond-scanner-fresh目录已存在，先备份..."
        mv diamond-scanner-fresh diamond-scanner-fresh-backup-$(date +%Y%m%d_%H%M%S)
    fi
    git clone https://github.com/harisucici/diamond-scanner.git diamond-scanner-fresh
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 已成功克隆到 diamond-scanner-fresh 目录"
        echo "📁 新目录: $(pwd)/diamond-scanner-fresh"
        echo "🌐 GitHub: https://github.com/harisucici/diamond-scanner"
        echo ""
        echo "请进入新目录:"
        echo "  cd diamond-scanner-fresh"
        echo "  然后运行: npm install && npm start"
    else
        echo "❌ 克隆失败，请检查网络和仓库权限"
    fi
    exit 0
fi

echo "📊 当前仓库状态:"
echo "  目录: $(pwd)"
echo "  远程: $(git remote get-url origin 2>/dev/null || echo '未配置')"
echo ""

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "当前分支: $CURRENT_BRANCH"

# 获取远程更新
echo "🔄 获取远程更新..."
git fetch origin

if [ $? -ne 0 ]; then
    echo "❌ 获取远程更新失败"
    echo "请检查:"
    echo "1. 网络连接"
    echo "2. 远程仓库URL: $(git remote -v)"
    echo "3. GitHub认证状态"
    exit 1
fi

# 检查同步状态
echo ""
echo "📈 同步状态检查..."

# 检查是否有远程develop分支
if ! git show-ref --verify --quiet refs/remotes/origin/develop; then
    echo "⚠️  远程没有develop分支"
    echo "远程分支列表:"
    git branch -r
    echo ""
    echo "请选择要同步的分支:"
    read -p "分支名称 (默认: main): " BRANCH_NAME
    BRANCH_NAME=${BRANCH_NAME:-main}
else
    BRANCH_NAME="develop"
fi

# 检查本地是否有所选分支
if ! git show-ref --verify --quiet refs/heads/$BRANCH_NAME; then
    echo "本地没有 $BRANCH_NAME 分支，正在创建..."
    git checkout -b $BRANCH_NAME origin/$BRANCH_NAME 2>/dev/null || {
        echo "❌ 无法创建分支，请先拉取远程分支"
        git fetch origin $BRANCH_NAME:$BRANCH_NAME
        git checkout $BRANCH_NAME
    }
fi

# 切换到目标分支
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo "切换到 $BRANCH_NAME 分支..."
    git checkout $BRANCH_NAME
fi

# 计算提交差异
BEHIND=$(git rev-list --count origin/$BRANCH_NAME..$BRANCH_NAME 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count $BRANCH_NAME..origin/$BRANCH_NAME 2>/dev/null || echo "0")

echo ""
echo "📊 分支差异统计:"
echo "  远程领先本地: $BEHIND 个提交"
echo "  本地领先远程: $AHEAD 个提交"

if [ "$BEHIND" -eq "0" ] && [ "$AHEAD" -eq "0" ]; then
    echo ""
    echo "✅ 本地与远程已完全同步"
    echo ""
    echo "📁 本地文件状态:"
    git status --short
    exit 0
fi

# 显示差异详情
echo ""
if [ "$BEHIND" -gt "0" ]; then
    echo "📥 远程有 $BEHIND 个本地没有的提交:"
    git log --oneline $BRANCH_NAME..origin/$BRANCH_NAME
fi

if [ "$AHEAD" -gt "0" ]; then
    echo "📤 本地有 $AHEAD 个远程没有的提交:"
    git log --oneline origin/$BRANCH_NAME..$BRANCH_NAME
fi

echo ""
echo "🔄 请选择同步操作:"
echo "1. 拉取远程更新 (git pull)"
echo "2. 硬重置到远程 (git reset --hard)"
echo "3. 仅查看差异，不执行同步"
echo "4. 推送本地提交到远程"
read -p "选择 (1/2/3/4): " choice

case $choice in
    1)
        echo "执行 git pull origin $BRANCH_NAME..."
        git pull origin $BRANCH_NAME
        if [ $? -eq 0 ]; then
            echo "✅ 拉取完成"
        else
            echo "❌ 拉取失败，可能有冲突需要解决"
            echo "请手动解决冲突后运行:"
            echo "  git add ."
            echo "  git commit -m '解决合并冲突'"
            echo "  git push origin $BRANCH_NAME"
        fi
        ;;
    2)
        echo "⚠️  警告: 硬重置会丢弃所有本地未提交的修改"
        read -p "确认执行硬重置? (y/n): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            echo "备份未提交的修改..."
            git stash
            echo "执行 git reset --hard origin/$BRANCH_NAME..."
            git reset --hard origin/$BRANCH_NAME
            echo "✅ 硬重置完成"
            echo "📁 当前文件状态:"
            git status --short
        else
            echo "❌ 取消硬重置"
        fi
        ;;
    3)
        echo "📝 显示完整差异..."
        echo ""
        echo "文件差异:"
        git diff --name-status origin/$BRANCH_NAME
        echo ""
        echo "内容差异:"
        git diff origin/$BRANCH_NAME --stat
        ;;
    4)
        if [ "$AHEAD" -gt "0" ]; then
            echo "推送 $AHEAD 个本地提交到远程..."
            git push origin $BRANCH_NAME
        else
            echo "⚠️  没有需要推送的本地提交"
        fi
        ;;
    *)
        echo "❌ 无效选择"
        ;;
esac

echo ""
echo "🔍 最终同步状态:"
git status
echo ""
echo "📊 提交历史 (最近3次):"
git log --oneline -3
echo ""
echo "🌐 GitHub仓库: https://github.com/harisucici/diamond-scanner/tree/$BRANCH_NAME"
echo "💻 本地目录: $(pwd)"
echo ""
echo "💎 同步操作完成！"