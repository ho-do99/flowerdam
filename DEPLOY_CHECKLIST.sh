#!/bin/bash

# 🚀 FlowerDam 배포 최종 체크리스트

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🚀 FlowerDam 배포 최종 준비 체크리스트               ║"
echo "╚════════════════════════════════════════════════════════════════╝"

PASS=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  if eval "$1" > /dev/null 2>&1; then
    echo "✅ $2"
    PASS=$((PASS + 1))
  else
    echo "❌ $2"
  fi
}

echo ""
echo "📋 환경 설정 확인"
echo "────────────────────────────────────────────────────────────────"

check "[ -f .env ]" "✓ .env 파일 존재"
check "grep -q 'DATABASE_URL' .env" "✓ DATABASE_URL 설정됨"
check "grep -q 'JWT_SECRET' .env" "✓ JWT_SECRET 설정됨"
check "lsof -i :3001 > /dev/null" "✓ 백엔드 API 실행 중 (포트 3001)"

echo ""
echo "📦 필수 패키지 확인"
echo "────────────────────────────────────────────────────────────────"

check "npm list prisma > /dev/null" "✓ Prisma ORM 설치됨"
check "npm list socket.io > /dev/null" "✓ Socket.io 설치됨"
check "npm list firebase-admin > /dev/null" "✓ Firebase Admin SDK 설치됨"

echo ""
echo "🔐 보안 설정 확인"
echo "────────────────────────────────────────────────────────────────"

check "grep -q 'JWT_SECRET' .env" "✓ JWT_SECRET 암호화됨"
check "grep '.env' .gitignore > /dev/null" "✓ .env가 .gitignore에 포함됨"
check "! grep -r 'serviceAccountKey.json' src/" "✓ 소스코드에 키 파일 미포함"

echo ""
echo "📱 프론트엔드 환경 확인"
echo "────────────────────────────────────────────────────────────────"

check "lsof -i :3000 > /dev/null" "✓ 관리자 대시보드 실행 중 (포트 3000)"
check "lsof -i :8081 > /dev/null" "✓ 모바일 앱 (Expo) 실행 중 (포트 8081)"

echo ""
echo "📚 배포 문서 확인"
echo "────────────────────────────────────────────────────────────────"

check "[ -f FIREBASE_SETUP.md ]" "✓ Firebase 설정 가이드"
check "[ -f PRODUCTION_DEPLOYMENT.md ]" "✓ 배포 완전 가이드"
check "[ -f TEST_REPORT.md ]" "✓ 테스트 보고서"
check "[ -f setup_firebase.sh ]" "✓ Firebase 자동 설정 스크립트"

echo ""
echo "════════════════════════════════════════════════════════════════"

PERCENT=$((PASS * 100 / TOTAL))
echo ""
echo "최종 준비 상태: $PASS/$TOTAL ✅ ($PERCENT%)"
echo ""

if [ $PERCENT -eq 100 ]; then
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║           🎉 배포 준비 완료! 시작할 준비됨!                   ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "다음 단계:"
  echo "  1️⃣  Firebase 설정: bash setup_firebase.sh"
  echo "  2️⃣  Railway 배포: https://railway.app"
  echo "  3️⃣  모바일 통합: 설명서 참고"
  echo ""
  exit 0
else
  echo "⚠️  일부 준비사항 미완료. 위 항목들을 확인해주세요."
  exit 1
fi
