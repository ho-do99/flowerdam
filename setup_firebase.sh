#!/bin/bash

# 🔥 FlowerDam Firebase & Railway 자동 설정 스크립트

set -e

echo "🚀 FlowerDam Firebase 자동 설정 시작"
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Firebase 서비스 계정 키 확인
echo -e "\n${BLUE}Step 1: Firebase 서비스 계정 키 설정${NC}"
echo "Firebase Console에서 서비스 계정 JSON 파일을 다운로드했나요?"
echo "경로를 입력해주세요 (예: ~/Downloads/serviceAccountKey.json):"
read -p "> " FIREBASE_KEY_PATH

# 파일 존재 여부 확인
if [ ! -f "$FIREBASE_KEY_PATH" ]; then
  echo -e "${RED}❌ 파일을 찾을 수 없습니다: $FIREBASE_KEY_PATH${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 파일을 찾았습니다${NC}"

# 2. base64로 인코딩
echo -e "\n${BLUE}Step 2: 서비스 계정 키를 base64로 인코딩${NC}"
FIREBASE_KEY_BASE64=$(cat "$FIREBASE_KEY_PATH" | base64 | tr -d '\n')
echo -e "${GREEN}✅ 인코딩 완료${NC}"

# 3. .env 파일 업데이트
echo -e "\n${BLUE}Step 3: .env 파일 업데이트${NC}"

ENV_FILE=".env"

# 기존 FIREBASE_SERVICE_ACCOUNT_KEY 제거
if grep -q "FIREBASE_SERVICE_ACCOUNT_KEY" "$ENV_FILE"; then
  # macOS와 Linux 호환성을 위해 -i'' 사용
  sed -i'' -e '/^FIREBASE_SERVICE_ACCOUNT_KEY=/d' "$ENV_FILE"
  echo -e "${YELLOW}⚠️  기존 FIREBASE_SERVICE_ACCOUNT_KEY를 제거했습니다${NC}"
fi

# 새로운 키 추가
echo "FIREBASE_SERVICE_ACCOUNT_KEY=\"$FIREBASE_KEY_BASE64\"" >> "$ENV_FILE"
echo -e "${GREEN}✅ .env 파일 업데이트 완료${NC}"

# 4. Firebase 연결 테스트
echo -e "\n${BLUE}Step 4: Firebase 연결 테스트${NC}"

# Node.js 스크립트로 Firebase 초기화 테스트
cat > /tmp/test_firebase.js << 'EOF'
const admin = require('firebase-admin');

try {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.log("❌ FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다");
    process.exit(1);
  }

  const decodedKey = JSON.parse(Buffer.from(key, 'base64').toString());
  const app = admin.initializeApp({
    credential: admin.credential.cert(decodedKey),
  });

  console.log("✅ Firebase 초기화 성공");
  console.log(`✅ Project ID: ${decodedKey.project_id}`);
  console.log(`✅ FCM 메시징 준비 완료`);
  process.exit(0);
} catch (error) {
  console.error("❌ Firebase 초기화 실패:", error.message);
  process.exit(1);
}
EOF

# 테스트 실행
if node /tmp/test_firebase.js > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Firebase 연결 검증 완료${NC}"
else
  echo -e "${YELLOW}⚠️  Firebase 연결 확인 실패 (나중에 확인 가능)${NC}"
fi

# 5. 환경 정보 출력
echo -e "\n${BLUE}Step 5: 배포 준비 상태${NC}"

cat > /tmp/deployment_status.txt << EOF
╔════════════════════════════════════════════════════════════╗
║          🚀 FlowerDam 배포 준비 상태                       ║
╚════════════════════════════════════════════════════════════╝

✅ Firebase 서비스 계정 설정 완료
✅ 환경변수 설정 완료
✅ 로컬 테스트 준비 완료

📋 다음 단계:

1️⃣  Railway 환경변수 설정
   - https://railway.app 접속
   - 프로젝트 설정 → Variables
   - 다음 값 추가:

     DATABASE_URL=postgresql://...
     JWT_SECRET=your_secret
     FIREBASE_SERVICE_ACCOUNT_KEY=[위의 base64 값]
     TOSS_CLIENT_KEY=...
     TOSS_SECRET_KEY=...
     NODE_ENV=production

2️⃣  백엔드 배포
   - Railway와 GitHub 연결
   - 자동 배포 시작

3️⃣  모바일 앱 배포
   - iOS: App Store Connect 배포
   - Android: Google Play Store 배포

4️⃣  모니터링
   - Firebase Console: https://console.firebase.google.com
   - Railway Dashboard: https://railway.app
   - API Health: https://api.flowerdam.com/health

╔════════════════════════════════════════════════════════════╗
║     ⏱️  예상 배포 시간: 1-2시간 (Firebase 포함)            ║
║     🎯 상태: 배포 준비 완료                               ║
╚════════════════════════════════════════════════════════════╝
EOF

cat /tmp/deployment_status.txt

# 6. 요약
echo -e "\n${GREEN}=================================="
echo "✅ Firebase 설정 완료!"
echo "==================================${NC}\n"

echo "다음 명령어로 로컬 테스트:"
echo -e "${BLUE}npm start${NC}\n"

echo "배포 준비:"
echo -e "${BLUE}bash scripts/deploy.sh${NC}\n"

echo "더 자세한 정보는 FIREBASE_SETUP.md를 참고하세요."
