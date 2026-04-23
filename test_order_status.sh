#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"

echo "=== 주문 상태 변경 테스트 ==\n"

# 기존 주문 ID 사용
ORDER_ID="94dcace8-ef70-4ac1-bb4c-6a4d3a9f09b8"

# Admin 로그인
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowerdam.com","password":"Admin@1234"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')

# 고객 로그인
CUSTOMER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test.customer@flower.com","password":"Test@1234"}')
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | jq -r '.data.accessToken')

echo "1️⃣ 현재 주문 상태 조회"
curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '.data.status'

echo ""
echo "2️⃣ 주문 상태를 ACCEPTED로 변경"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED"}' | jq '.data | {id, status}'

echo ""
echo "3️⃣ 주문 상태를 IN_PROGRESS로 변경"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}' | jq '.data | {id, status}'

echo ""
echo "4️⃣ 주문 상태를 DELIVERING로 변경"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"DELIVERING"}' | jq '.data | {id, status}'

echo ""
echo "5️⃣ 주문 상태를 COMPLETED로 변경"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}' | jq '.data | {id, status}'

echo ""
echo "✅ 주문 상태 변경 테스트 완료"

