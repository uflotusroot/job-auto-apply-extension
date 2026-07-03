#!/bin/bash
# 版本提交脚本
# 使用方法: ./commit_version.sh "更新描述"

set -e

# 获取版本号
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | sed 's/"version": "\(.*\)"/\1/')

# 获取提交信息
if [ -n "$1" ]; then
    MESSAGE="$1"
else
    MESSAGE="更新到版本 $VERSION"
fi

echo "======================================"
echo "  版本提交脚本"
echo "  当前版本: $VERSION"
echo "  提交信息: $MESSAGE"
echo "======================================"

# 添加所有文件
echo "[1/5] 添加文件..."
git add .

# 提交
echo "[2/5] 提交代码..."
git commit -m "$MESSAGE"

# 创建tag
echo "[3/5] 创建版本标签..."
git tag -a "v$VERSION" -m "版本 $VERSION"

echo ""
echo "✓ 版本 $VERSION 已提交!"
echo ""
echo "下一步:"
echo "  1. 在GitHub上创建仓库"
echo "  2. 配置远程仓库: git remote add origin https://github.com/你的用户名/仓库名.git"
echo "  3. 推送代码: git push -u origin master --tags"