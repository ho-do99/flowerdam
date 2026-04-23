#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"

echo "=== 가맹점/직원 가입 및 승인 테스트 ==\n"

# Admin 로그인
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowerdam.com","password":"Admin@1234"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')
echo "✅ Admin 로그인 완료"

# 1️⃣ 가맹점 사장 회원가입
echo ""
echo "1️⃣ 가맹점 사장 회원가입"
OWNER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "partner_owner",
    "name": "김화원",
    "email": "owner.test@flower.com",
    "password": "Owner@1234",
    "phone": "01098765432"
  }')
echo "$OWNER_RESPONSE" | jq .
OWNER_ID=$(echo "$OWNER_RESPONSE" | jq -r '.data.user.id // empty')
echo "가맹점 사장 ID: $OWNER_ID"

# 2️⃣ 가맹점 사장 로그인
echo ""
echo "2️⃣ 가맹점 사장 로그인"
OWNER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner.test@flower.com",
    "password": "Owner@1234"
  }')
OWNER_TOKEN=$(echo "$OWNER_LOGIN" | jq -r '.data.accessToken // empty')

if [ -z "$OWNER_TOKEN" ]; then
  echo "❌ 가맹점 사장 로그인 실패"
  echo "$OWNER_LOGIN" | jq .
else
  echo "✅ 가맹점 사장 로그인 성공"
fi

# 3️⃣ 가맹점 정보 조회 (사장 입장에서)
echo ""
echo "3️⃣ 가맹점 정보 조회"
PARTNER_INFO=$(curl -s -X GET "$BASE_URL/partners/me" \
  -H "Authorization: Bearer $OWNER_TOKEN")
echo "$PARTNER_INFO" | jq .

PARTNER_ID=$(echo "$PARTNER_INFO" | jq -r '.data.id // empty')

# 4️⃣ 가맹점 직원 회원가입
echo ""
echo "4️⃣ 가맹점 직원 회원가입"
STAFF_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "partner_staff",
    "name": "이꽃",
    "email": "staff.test@flower.com",
    "password": "Staff@1234",
    "phone": "01087654321"
  }')
echo "$STAFF_RESPONSE" | jq .
STAFF_ID=$(echo "$STAFF_RESPONSE" | jq -r '.data.user.id // empty')
echo "직원 ID: $STAFF_ID"

# 5️⃣ Admin에서 가맹점 목록 조회
echo ""
echo "5️⃣ Admin에서 가맹점 목록 조회"
PARTNERS=$(curl -s -X GET "$BASE_URL/partners" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PARTNERS" | jq '.data | map({id, name, status})'

# 6️⃣ Admin이 가맹점 승인
if [ ! -z "$PARTNER_ID" ]; then
  echo ""
  echo "6️⃣ Admin이 가맹점 승인"
  APPROVE=$(curl -s -X POST "$BASE_URL/partners/$PARTNER_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "$APPROVE" | jq '.data | {id, status}'
fi

echo ""
echo "✅ 가맹점/직원 가입 및 승인 테스트 완료"

