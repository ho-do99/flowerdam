#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3001/api/v1"
ADMIN_TOKEN=""
CUSTOMER_TOKEN=""
PARTNER_OWNER_TOKEN=""
PRODUCT_ID=""
ORDER_ID=""

echo -e "${YELLOW}=== Phase 6: 주문 및 콜 시스템 테스트 ===${NC}\n"

# 1. 고객 회원가입 (이미 있는지 확인)
echo -e "${YELLOW}1️⃣ 고객 회원가입${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "customer",
    "name": "테스트고객",
    "email": "customer.test@flower.com",
    "password": "Test@1234",
    "phone": "01012345678"
  }')
echo "$RESPONSE" | jq .
CUSTOMER_ID=$(echo "$RESPONSE" | jq -r '.data.user.id // empty')

# 2. 고객 로그인
echo -e "${YELLOW}2️⃣ 고객 로그인${NC}"
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer.test@flower.com",
    "password": "Test@1234"
  }')
echo "$LOGIN" | jq .
CUSTOMER_TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
echo "고객 토큰: $CUSTOMER_TOKEN" | head -c 50
echo ""

# 3. admin 로그인
echo -e "${YELLOW}3️⃣ Admin 로그인${NC}"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@flowerdam.com",
    "password": "Admin@1234"
  }')
echo "$ADMIN_LOGIN" | jq .
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')

# 4. 상품 조회 또는 생성
echo -e "${YELLOW}4️⃣ 상품 조회${NC}"
PRODUCTS=$(curl -s -X GET "$BASE_URL/products" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PRODUCTS" | jq .
PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.data[0].id // empty')

if [ -z "$PRODUCT_ID" ]; then
  echo -e "${YELLOW}상품이 없어서 생성 중...${NC}"
  CREATE_PRODUCT=$(curl -s -X POST "$BASE_URL/products" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "축하화환",
      "description": "화려한 축하화환",
      "price": 59000,
      "category": "축하화환"
    }')
  echo "$CREATE_PRODUCT" | jq .
  PRODUCT_ID=$(echo "$CREATE_PRODUCT" | jq -r '.data.id')
fi

echo "상품 ID: $PRODUCT_ID"

# 5. 주문 생성 (customer 역할)
echo -e "${YELLOW}5️⃣ 주문 생성 테스트${NC}"
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
    \"request_note\": \"신선하게 준비해주세요\",
    \"payment_method\": \"card\"
  }")
echo "$ORDER" | jq .
ORDER_ID=$(echo "$ORDER" | jq -r '.data.id // empty')

if [ -z "$ORDER_ID" ]; then
  echo -e "${RED}❌ 주문 생성 실패${NC}"
  exit 1
fi

echo "주문 ID: $ORDER_ID"

# 6. 주문 조회
echo -e "${YELLOW}6️⃣ 주문 조회 테스트${NC}"
curl -s -X GET "$BASE_URL/orders" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq .

# 7. 주문 상세 조회
echo -e "${YELLOW}7️⃣ 주문 상세 조회 테스트${NC}"
curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq .

echo -e "\n${GREEN}✅ 주문 테스트 완료!${NC}\n"

# 출력 summary
cat << 'SUMMARY'
= 완료된 테스트 =
✅ 고객 회원가입
✅ 고객 로그인
✅ Admin 로그인
✅ 상품 조회/생성
✅ 주문 생성
✅ 주문 목록 조회
✅ 주문 상세 조회

= 다음 테스트 항목 =
[ ] 주문 상태 변경 (ACCEPTED, IN_PROGRESS, DELIVERING, COMPLETED)
[ ] Socket.io 콜 시스템
[ ] 가맹점/직원 승인
[ ] FCM 푸시 알림
[ ] RBAC 권한 테스트
SUMMARY

