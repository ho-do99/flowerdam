#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"
PARTNER_ID="a633c577-4816-44c8-9ad1-d8f8d8c9a842"

# Admin 로그인
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowerdam.com","password":"Admin@1234"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken')

echo "=== 파트너 승인 테스트 ==\n"

echo "1️⃣ Admin이 파트너 목록 조회"
PARTNERS=$(curl -s -X GET "$BASE_URL/partners" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PARTNERS" | jq '.data'

echo ""
echo "2️⃣ Admin이 파트너 승인"
APPROVE=$(curl -s -X POST "$BASE_URL/partners/$PARTNER_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$APPROVE" | jq .

echo ""
echo "3️⃣ 파트너 상태 확인"
curl -s -X GET "$BASE_URL/partners" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | select(.id == "'$PARTNER_ID'") | {id, name, status}'

echo ""
echo "✅ 파트너 승인 테스트 완료"

