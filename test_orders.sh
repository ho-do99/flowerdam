#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"

echo "=== 주문 테스트 ==\n"

# 1. Admin 로그인
echo "1️⃣ Admin 로그인"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@flowerdam.com",
    "password": "Admin@1234"
  }')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin 로그인 실패"
  echo "$ADMIN_LOGIN" | jq .
  exit 1
fi
echo "✅ Admin 로그인 성공"

# 2. 고객 회원가입
echo ""
echo "2️⃣ 고객 회원가입"
CUSTOMER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "customer",
    "name": "테스트고객",
    "email": "test.customer@flower.com",
    "password": "Test@1234",
    "phone": "01012345678"
  }')
CUSTOMER_ID=$(echo "$CUSTOMER" | jq -r '.data.user.id // empty')
echo "고객 ID: $CUSTOMER_ID"

# 3. 고객 로그인
echo ""
echo "3️⃣ 고객 로그인"
CUSTOMER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.customer@flower.com",
    "password": "Test@1234"
  }')
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | jq -r '.data.accessToken')
echo "고객 토큰: ${CUSTOMER_TOKEN:0:50}..."

# 4. 상품 조회
echo ""
echo "4️⃣ 상품 조회"
PRODUCTS=$(curl -s -X GET "$BASE_URL/products" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.data.data[0].id // .data[0].id // empty')
PRODUCT_PRICE=$(echo "$PRODUCTS" | jq -r '.data.data[0].price // .data[0].price')
echo "상품 ID: $PRODUCT_ID"
echo "상품가: $PRODUCT_PRICE"

# 5. 주문 생성
echo ""
echo "5️⃣ 주문 생성"
ORDER=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"product_id\": \"$PRODUCT_ID\",
    \"recipient_name\": \"김철수\",
    \"delivery_place\": \"서울시청\",
    \"delivery_address\": \"서울시 중구 태평로 100\",
    \"delivery_datetime\": \"2026-04-25T10:00:00\",
    \"ribbon_message\": \"축하합니다!\",
    \"request_note\": \"신선하게\",
    \"payment_method\": \"card\"
  }")
ORDER_ID=$(echo "$ORDER" | jq -r '.data.id // empty')

if [ -z "$ORDER_ID" ]; then
  echo "❌ 주문 생성 실패"
  echo "$ORDER" | jq .
  exit 1
fi
echo "✅ 주문 생성 성공"
echo "주문 ID: $ORDER_ID"

# 6. 주문 조회
echo ""
echo "6️⃣ 주문 목록 조회"
curl -s -X GET "$BASE_URL/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '.data.data | length as $count | "조회된 주문 수: \($count)"'

# 7. 주문 상세 조회
echo ""
echo "7️⃣ 주문 상세 조회"
curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '.data | {id, status, price, recipient_name}'

echo ""
echo "✅ 주문 생성/조회 테스트 완료"
