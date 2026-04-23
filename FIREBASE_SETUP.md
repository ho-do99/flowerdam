# 🔥 Firebase 설정 및 배포 가이드

**상태**: 📋 자동화 설정 준비 완료  
**예상 소요시간**: 30분  
**난이도**: 초급

---

## 📋 Firebase 설정 체크리스트

### 1단계: Firebase 프로젝트 생성 (5분)

```bash
# 1. https://console.firebase.google.com 접속
# 2. "새 프로젝트" 클릭
# 3. 프로젝트명 입력: "FlowerDam"
# 4. Google Analytics 활성화 (선택)
# 5. 프로젝트 생성 완료
```

### 2단계: Firebase 서비스 계정 키 다운로드 (5분)

```bash
# Firebase Console → 프로젝트 설정 → 서비스 계정
# "새 비공개 키 생성" 클릭 → JSON 파일 다운로드

# 다운로드한 파일명: serviceAccountKey.json
```

### 3단계: 환경변수 설정 (5분)

```bash
# serviceAccountKey.json을 base64로 인코딩
cat /path/to/serviceAccountKey.json | base64 | tr -d '\n'

# 출력된 긴 문자열을 .env에 추가
FIREBASE_SERVICE_ACCOUNT_KEY="[위에서 복사한 base64 문자열]"
```

---

## 🚀 자동화 스크립트 사용

### 방법 1: 대화형 설정 (추천)

```bash
# 다음 명령어 실행
bash setup_firebase.sh

# 프롬프트에 따라:
# 1. serviceAccountKey.json 경로 입력
# 2. 자동으로 base64 인코딩
# 3. .env 파일에 자동 추가
# 4. 검증 완료
```

### 방법 2: 직접 명령어

```bash
# Step 1: 키 파일을 base64로 인코딩
export FIREBASE_KEY=$(cat serviceAccountKey.json | base64 | tr -d '\n')

# Step 2: .env 파일에 추가
echo "FIREBASE_SERVICE_ACCOUNT_KEY=\"$FIREBASE_KEY\"" >> .env

# Step 3: Firebase 연결 테스트
npm run test:firebase
```

---

## ✅ Firebase 연결 검증

### 검증 명령어

```bash
# Firebase 연결 테스트
npx ts-node -e "
import { initializeFirebase } from './src/config/firebase';
const app = initializeFirebase();
console.log(app ? '✅ Firebase 연결 성공' : '❌ Firebase 연결 실패');
"
```

### 예상 결과

```
✅ Firebase 연결 성공
✅ FCM 메시징 활성화 완료
✅ 푸시 알림 준비 완료
```

---

## 🔧 FCM (Firebase Cloud Messaging) 설정

### 1. Cloud Messaging 활성화

```
Firebase Console → Cloud Messaging → 활성화
```

### 2. 웹 앱 등록

```
Firebase Console → 프로젝트 설정 → 웹 앱 추가
앱 닉네임: "FlowerDam Web"
등록 → SDK 스니펫 복사 (모바일에서 사용)
```

### 3. 모바일 앱 등록

#### iOS 앱

```
Firebase Console → 프로젝트 설정 → iOS 앱 추가
패키지명: com.flowerdam.ios
등록 → GoogleService-Info.plist 다운로드
프로젝트의 app.json에 추가
```

#### Android 앱

```
Firebase Console → 프로젝트 설정 → Android 앱 추가
패키지명: com.flowerdam.android
등록 → google-services.json 다운로드
프로젝트의 android 폴더에 추가
```

---

## 📱 모바일 앱 FCM 설정

### Expo 앱에 FCM 추가

```bash
cd mobile

# 1. 필요한 패키지 설치
npx expo install expo-notifications firebase

# 2. Firebase 설정 (config.json)
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png"
        }
      ]
    ]
  }
}

# 3. 백그라운드 태스크 처리
npx expo install expo-task-manager
```

### iOS 푸시 인증서 설정

```bash
# 1. Apple Developer에서 푸시 인증서 생성
# 2. Firebase Console → 프로젝트 설정 → Cloud Messaging → iOS 인증서 업로드
```

---

## 🚀 Railway 배포

### 1단계: Railway 계정 생성

```bash
# 1. https://railway.app 접속
# 2. GitHub 계정으로 로그인
# 3. 새 프로젝트 시작
```

### 2단계: 환경변수 설정

```bash
# Railway Dashboard → 프로젝트 → Variables

DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_key
TOSS_CLIENT_KEY=toss_key
TOSS_SECRET_KEY=toss_secret
NODE_ENV=production
```

### 3단계: 배포

```bash
# GitHub 리포지토리 연결
# Railway가 자동으로 감지하고 배포

# 배포 상태 확인
railway logs

# 웹훅 설정
# 프로덕션 API: https://[railway-domain]/api/v1
```

---

## 📊 배포 후 검증

### API 헬스 체크

```bash
curl -X GET https://api.flowerdam.com/health
# 예상 응답:
# {"status": "ok", "firebase": true, "database": true}
```

### FCM 푸시 테스트

```bash
# 테스트 토큰으로 푸시 발송
curl -X POST https://api.flowerdam.com/api/v1/notifications/test \
  -H "Authorization: Bearer {token}" \
  -d '{"title": "테스트", "body": "Firebase 연결 확인"}'
```

### Socket.io 실시간 테스트

```bash
# 웹소켓 연결 테스트
wscat -c wss://api.flowerdam.com/socket.io/?transport=websocket
```

---

## 🔐 보안 주의사항

### ✅ 필수 확인

- [ ] `serviceAccountKey.json` 절대 코드에 커밋 금지
- [ ] `.env` 파일에만 보관 (`.gitignore`에 추가됨)
- [ ] 비공개 키는 절대 공개 공간에 노출 금지
- [ ] Railway 환경변수는 암호화됨
- [ ] 정기적으로 서비스 계정 키 로테이션

### 환경변수 보안

```bash
# .env.example (안전하게 공유 가능)
FIREBASE_SERVICE_ACCOUNT_KEY="[redacted]"

# .env (절대 공유 금지)
FIREBASE_SERVICE_ACCOUNT_KEY="eyJhbGc..."
```

---

## 📈 모니터링

### Firebase Console에서

- 프로젝트 설정 → 모니터링 → 활성화
- 실시간 분석 확인
- 에러 로그 확인

### Railway에서

- Logs 탭에서 에러 확인
- Metrics 탭에서 성능 모니터링
- Webhooks 설정으로 알림 받기

---

## 🎯 예상 일정

```
Step 1: Firebase 프로젝트 생성        (5분)
Step 2: 서비스 계정 키 다운로드       (5분)
Step 3: 환경변수 설정                 (5분)
Step 4: Railway 환경변수 설정         (5분)
Step 5: 배포 및 검증                  (10분)
────────────────────────────────────
총 소요시간: 30분
```

---

## ❓ FAQ

### Q: Firebase 없이도 배포 가능한가?
A: 가능하지만 FCM 푸시 알림이 비활성화됩니다. 콜 시스템은 Socket.io만으로 작동합니다.

### Q: 비용이 드나?
A: Firebase 무료 플랜으로 충분합니다 (월 100,000 메시지까지 무료).

### Q: 후에 Firebase 업그레이드 가능한가?
A: 네, 언제든 업그레이드 가능합니다.

### Q: 기존 데이터 마이그레이션 필요한가?
A: 아니오. Firebase는 인증/메시징만 담당합니다.

---

## 📞 트러블슈팅

### Firebase 연결 실패

```bash
# 1. 환경변수 확인
echo $FIREBASE_SERVICE_ACCOUNT_KEY

# 2. 베이스64 디코딩 확인
echo $FIREBASE_SERVICE_ACCOUNT_KEY | base64 -d | jq .

# 3. 재실행
npm start
```

### FCM 메시지 송신 실패

```bash
# 1. 토큰 확인
# 2. 앱 권한 확인 (iOS: APN 인증서, Android: google-services.json)
# 3. Firebase Console → Cloud Messaging → 권장 설정 확인
```

### Railway 배포 실패

```bash
# 1. 환경변수 모두 설정했는지 확인
# 2. 빌드 로그 확인: railway logs
# 3. 로컬에서 먼저 테스트: npm start
```

---

**최종 배포 예상**: 2026-04-24 (30분 소요)
**상태**: 🟢 준비 완료

---
