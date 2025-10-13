#!/bin/bash

# コスト監視スクリプト
# 定期的に実行してコストを確認

set -e

echo "💰 コスト使用状況チェック"
echo "=========================="
echo ""

# Railway使用状況
echo "📊 Railway 使用状況:"
if command -v railway &> /dev/null; then
    railway status
else
    echo "⚠️  Railway CLIがインストールされていません"
    echo "   インストール: npm install -g @railway/cli"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Neon使用状況
echo "🗄️  Neon PostgreSQL 使用状況:"
echo "   Neonコンソールで確認してください:"
echo "   https://console.neon.tech/"
echo ""

# Vercel使用状況
echo "🌐 Vercel 使用状況:"
if command -v vercel &> /dev/null; then
    vercel inspect
else
    echo "⚠️  Vercel CLIがインストールされていません"
    echo "   インストール: npm install -g vercel"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# コスト見積もり
echo "💵 予想月額コスト:"
echo "   Vercel:   $0/月  (Hobby Plan)"
echo "   Neon:     $0/月  (無料枠)"
echo "   Railway:  $5-15/月 (使用量による)"
echo "   ────────────────────────────"
echo "   合計:     $5-15/月"
echo ""

# アラート設定の確認
echo "⚠️  コストアラート設定:"
echo "   Railwayダッシュボードで支出上限を設定してください"
echo "   推奨: $20/月"
echo ""
