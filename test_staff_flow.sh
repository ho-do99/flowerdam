#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"
PARTNER_ID="a633c577-4816-44c8-9ad1-d8f8d8c9a842"

# 파트너 사장 로그인
OWNER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner.test@flower.com","password":"Owner@1234"}')
OWNER_TOKEN=$(echo "$OWNER_LOGIN" | jq -r '.data.accessToken')

# 직원 로그인
STAFF_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff.test@flower.com","password":"Staff@1234"}')
STAFF_TOKEN=$(echo "$STAFF_LOGIN" | jq -r '.data.accessToken // empty')

echo "=== 직원 승인 테스트 ==\n"

echo "1️⃣ 직원 정보 조회"
if [ ! -z "$STAFF_TOKEN" ]; then
  curl -s -X GET "$BASE_URL/partners/me" \
    -H "Authorization: Bearer $STAFF_TOKEN" | jq .
else
  echo "❌ 직원 로그인 실패"
fi

echo ""
echo "2️⃣ 파트너 사장에게 있는 직원 목록 조회"
STAFF_LIST=$(curl -s -X GET "$BASE_URL/partners/staff" \
  -H "Authorization: Bearer $OWNER_TOKEN")
echo "$STAFF_LIST" | jq .

echo ""
echo "✅ 직원 승인 테스트 완료"

