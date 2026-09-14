#!/bin/bash

# 测试定时邮件发送 Edge Function
# 用法：./test-cron.sh

echo "正在调用定时邮件发送 Edge Function..."
echo ""

response=$(curl -s -X POST \
  "https://backend.appmiaoda.com/projects/supabase275158120102146048/functions/v1/send-scheduled-email" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "响应结果："
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# 检查是否成功
if echo "$response" | grep -q '"success":true'; then
  echo "✅ 调用成功！"
else
  echo "❌ 调用失败，请检查错误信息"
fi
