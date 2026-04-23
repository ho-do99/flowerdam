#!/usr/bin/env node

const io = require('socket.io-client');

// 테스트 설정
const SERVER_URL = 'http://localhost:3001';
const TEST_ORDER_ID = 'test-order-' + Date.now();
const TEST_PARTNER_ID = 'test-partner-' + Date.now();
const TEST_CUSTOMER_ID = 'test-customer-' + Date.now();
const TEST_REGION = 'SEOUL';

// 이벤트 카운터
let eventsReceived = {
  partner: [],
  customer: [],
};

// 파트너 소켓
const partnerSocket = io(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// 고객 소켓
const customerSocket = io(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// ============================================================
// 파트너 소켓 이벤트 리스너
// ============================================================

partnerSocket.on('connect', () => {
  console.log(`\n✅ 파트너 소켓 연결됨: ${partnerSocket.id}`);
  eventsReceived.partner.push('connect');
});

partnerSocket.on('partner:registered', (data) => {
  console.log(`✅ 파트너 등록 완료:`, data);
  eventsReceived.partner.push('partner:registered');
});

partnerSocket.on('order:incoming', (data) => {
  console.log(`🔔 [파트너] 새 주문 수신:`, data);
  eventsReceived.partner.push('order:incoming');

  // 파트너가 주문을 수락
  setTimeout(() => {
    console.log(`\n🎯 파트너가 주문을 수락합니다...`);
    partnerSocket.emit('order:accept', {
      order_id: data.order_id,
      partner_id: TEST_PARTNER_ID,
    });
  }, 1000);
});

partnerSocket.on('order:assigned', (data) => {
  console.log(`✅ [파트너] 주문 배정 확인:`, data);
  eventsReceived.partner.push('order:assigned');
});

partnerSocket.on('order:cancelled', (data) => {
  console.log(`❌ [파트너] 주문 취소:`, data);
  eventsReceived.partner.push('order:cancelled');
});

partnerSocket.on('order:accept_failed', (data) => {
  console.log(`❌ [파트너] 수락 실패:`, data);
  eventsReceived.partner.push('order:accept_failed');
});

partnerSocket.on('disconnect', () => {
  console.log(`❌ 파트너 소켓 연결 해제됨`);
});

partnerSocket.on('error', (error) => {
  console.error(`❌ 파트너 소켓 에러:`, error);
});

// ============================================================
// 고객 소켓 이벤트 리스너
// ============================================================

customerSocket.on('connect', () => {
  console.log(`\n✅ 고객 소켓 연결됨: ${customerSocket.id}`);
  eventsReceived.customer.push('connect');
});

customerSocket.on('customer:registered', (data) => {
  console.log(`✅ 고객 등록 완료:`, data);
  eventsReceived.customer.push('customer:registered');
});

customerSocket.on('order:call_sent', (data) => {
  console.log(`✅ [고객] 콜 발신 완료:`, data);
  eventsReceived.customer.push('order:call_sent');
});

customerSocket.on('order:accepted', (data) => {
  console.log(`✅ [고객] 파트너가 주문을 수락했습니다:`, data);
  eventsReceived.customer.push('order:accepted');
});

customerSocket.on('order:status_changed', (data) => {
  console.log(`📊 [고객] 주문 상태 변경:`, data);
  eventsReceived.customer.push('order:status_changed');
});

customerSocket.on('disconnect', () => {
  console.log(`❌ 고객 소켓 연결 해제됨`);
});

customerSocket.on('error', (error) => {
  console.error(`❌ 고객 소켓 에러:`, error);
});

// ============================================================
// 테스트 흐름
// ============================================================

async function runTest() {
  console.log('\n🚀 Socket.io 콜 시스템 통합 테스트 시작\n');
  console.log(`📋 테스트 데이터:`);
  console.log(`   - Order ID: ${TEST_ORDER_ID}`);
  console.log(`   - Partner ID: ${TEST_PARTNER_ID}`);
  console.log(`   - Customer ID: ${TEST_CUSTOMER_ID}`);
  console.log(`   - Region: ${TEST_REGION}`);

  // 1단계: 파트너와 고객 연결 대기
  await new Promise((resolve) => {
    setTimeout(() => {
      if (partnerSocket.connected && customerSocket.connected) {
        console.log(`\n✅ 양쪽 소켓 연결 완료`);
        resolve();
      } else {
        console.error(`❌ 소켓 연결 실패`);
        process.exit(1);
      }
    }, 2000);
  });

  // 2단계: 파트너 등록
  console.log(`\n📍 1단계: 파트너 등록...`);
  partnerSocket.emit('partner:register', {
    partner_id: TEST_PARTNER_ID,
    region: TEST_REGION,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 3단계: 고객 등록
  console.log(`📍 2단계: 고객 등록...`);
  customerSocket.emit('customer:register', {
    customer_id: TEST_CUSTOMER_ID,
    region: TEST_REGION,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // 4단계: 콜 발신
  console.log(`📍 3단계: 고객이 주문 콜 발신...`);
  customerSocket.emit('order:call', {
    order_id: TEST_ORDER_ID,
    recipient_name: '테스트 고객',
    delivery_address: '서울시 강남구 테스트동',
    delivery_place: '테스트 행사장',
    product_name: '근조화환',
    price: 59000,
    region: TEST_REGION,
    customer_id: TEST_CUSTOMER_ID,
  });

  // 충분한 시간 대기 (수락 포함)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // ============================================================
  // 결과 보고
  // ============================================================

  console.log(`\n\n📊 테스트 결과 요약\n${'='.repeat(60)}`);

  console.log(`\n[파트너 수신 이벤트]`);
  if (eventsReceived.partner.length === 0) {
    console.log(`  ❌ 이벤트 없음`);
  } else {
    eventsReceived.partner.forEach((event, idx) => {
      console.log(`  ${idx + 1}. ✅ ${event}`);
    });
  }

  console.log(`\n[고객 수신 이벤트]`);
  if (eventsReceived.customer.length === 0) {
    console.log(`  ❌ 이벤트 없음`);
  } else {
    eventsReceived.customer.forEach((event, idx) => {
      console.log(`  ${idx + 1}. ✅ ${event}`);
    });
  }

  const totalEvents = eventsReceived.partner.length + eventsReceived.customer.length;
  console.log(`\n총 수신 이벤트: ${totalEvents}개`);

  // 필수 이벤트 체크
  console.log(`\n[필수 이벤트 체크]`);
  const checks = [
    { name: '파트너 연결', event: 'connect', arr: eventsReceived.partner },
    { name: '파트너 등록', event: 'partner:registered', arr: eventsReceived.partner },
    { name: '고객 연결', event: 'connect', arr: eventsReceived.customer },
    { name: '고객 등록', event: 'customer:registered', arr: eventsReceived.customer },
    { name: '콜 발신 완료', event: 'order:call_sent', arr: eventsReceived.customer },
    { name: '파트너 콜 수신', event: 'order:incoming', arr: eventsReceived.partner },
    { name: '고객 수락 확인', event: 'order:accepted', arr: eventsReceived.customer },
  ];

  checks.forEach((check) => {
    const found = check.arr.includes(check.event);
    console.log(`  ${found ? '✅' : '❌'} ${check.name} (${check.event})`);
  });

  console.log(`\n${'='.repeat(60)}\n`);

  // 정리
  partnerSocket.disconnect();
  customerSocket.disconnect();
  process.exit(0);
}

// 테스트 시작
runTest().catch((error) => {
  console.error(`\n❌ 테스트 오류:`, error);
  process.exit(1);
});

// 타임아웃 (테스트가 무한 대기하는 것을 방지)
setTimeout(() => {
  console.error(`\n⏱️ 테스트 타임아웃 (10초 초과)`);
  process.exit(1);
}, 10000);
