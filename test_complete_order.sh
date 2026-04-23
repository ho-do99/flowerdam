#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"
ORDER_ID="94dcace8-ef70-4ac1-bb4c-6a4d3a9f09b8"

# Admin 토큰 얻기
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowerdam.com","password":"Admin@1234"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')

echo "=== 주문 결제 및 상태 변경 테스트 ==\n"

echo "1️⃣ 결제 확인"
PAYMENT=$(curl -s -X POST "$BASE_URL/payments/confirm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"paymentKey\": \"test_payment_key\",
    \"amount\": 59000
  }")
echo "$PAYMENT" | jq .

echo ""
echo "2️⃣ 현재 주문 상태 조회"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test.customer@flower.com","password":"Test@1234"}' | jq -r '.data.accessToken' > /tmp/customer_token.txt
CUSTOMER_TOKEN=$(cat /tmp/customer_token.txt)

curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '.data.status'

echo ""
echo "3️⃣ 상태를 ACCEPTED로 변경"
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED"}' | jq '.data | {id, status}'

