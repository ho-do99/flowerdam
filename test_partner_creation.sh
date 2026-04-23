#!/bin/bash

BASE_URL="http://localhost:3001/api/v1"

# 가맹점 사장 로그인
OWNER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner.test@flower.com",
    "password": "Owner@1234"
  }')
OWNER_TOKEN=$(echo "$OWNER_LOGIN" | jq -r '.data.accessToken')

echo "=== 파트너 생성 테스트 ==\n"

echo "1️⃣ 파트너 정보 생성 (가맹점 사장)"
PARTNER=$(curl -s -X POST "$BASE_URL/partners" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "김화원 화원",
    "region": "서울시 강남구",
    "address": "서울시 강남구 테헤란로 123",
    "business_number": "123-45-67890"
  }')
echo "$PARTNER" | jq .

PARTNER_ID=$(echo "$PARTNER" | jq -r '.data.id // empty')
echo "파트너 ID: $PARTNER_ID"

echo ""
echo "2️⃣ 파트너 정보 조회"
curl -s -X GET "$BASE_URL/partners/me" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq '.data | {id, name, status}'

echo ""
echo "✅ 파트너 생성 테스트 완료"

