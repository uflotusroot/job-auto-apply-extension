#!/bin/bash
# GitHub推送脚本
# 使用方法: ./push_to_github.sh

set -e

echo "======================================"
echo "  GitHub推送脚本"
echo "======================================"

# 检查是否已配置远程仓库
REMOTE=$(git remote -v | grep origin || true)

if [ -z "$REMOTE" ]; then
    echo "错误: 未配置远程仓库!"
    echo ""
    echo "请先在GitHub上创建仓库，然后执行:"
    echo ""
    echo "  git remote add origin https://github.com/你的用户名/你的仓库名.git"
    echo ""
    echo "或者使用SSH:"
    echo ""
    echo "  git remote add origin git@github.com:你的用户名/你的仓库名.git"
    echo ""
    exit 1
fi

echo "远程仓库: $REMOTE"
echo ""

# 获取当前分支
BRANCH=$(git branch --show-current)

# 推送代码和标签
echo "[1/2] 推送代码到 $BRANCH 分支..."
git push -u origin "$BRANCH"

echo "[2/2] 推送标签..."
git push origin --tags

echo ""
echo "✓ 推送完成!"
echo ""
echo "仓库地址: https://github.com/$(git remote get-url origin | sed 's/.*github\.com\/\([^/]*\/[^.]*\).*/\1/')"