#!/bin/bash
cd "$(dirname "$0")"
echo "======================================"
echo " Wall AI - GitHubへ更新を送信"
echo "======================================"
echo ""

# 前回の作業で残ったロックファイルを掃除
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/*.lock 2>/dev/null

if [ -n "$(git status --porcelain)" ]; then
  git add .
  read -p "コミットメッセージを入力（空欄なら「更新」）: " msg
  if [ -z "$msg" ]; then
    msg="更新"
  fi
  git commit -m "$msg"
else
  echo "→ 新しい変更はありません。コミット済みの内容を送信します。"
fi

echo ""
git push
STATUS=$?
echo ""
if [ $STATUS -eq 0 ]; then
  echo "✓ GitHubへの送信が完了しました。"
  echo "  Vercelが自動でデプロイします（1〜2分ほどお待ちください）"
else
  echo "✗ 送信に失敗しました（エラーコード: $STATUS）"
  echo "  上のメッセージを確認してください。"
fi
echo ""
read -p "Enterキーを押してウィンドウを閉じてください..."
