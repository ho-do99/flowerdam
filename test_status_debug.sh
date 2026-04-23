#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"
ORDER_ID="94dcace8-ef70-4ac1-bb4c-6a4d3a9f09b8"

# Admin 토큰 얻기
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowerdam.com","password":"Admin@1234"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')

echo "Admin 토큰: ${ADMIN_TOKEN:0:30}..."
echo ""

# 상태 변경 시도 - 전체 응답 출력
echo "주문 상태 변경 요청:"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED"}' | jq .

