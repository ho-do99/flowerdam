const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

console.log('=== 🚀 Socket.io 콜 시스템 테스트 ===\n');

// 파트너 소켓
const partnerSocket = io(SERVER_URL, { reconnection: true });
const customerSocket = io(SERVER_URL, { reconnection: true });

const PARTNER_ID = 'a633c577-4816-44c8-9ad1-d8f8d8c9a842';
const CUSTOMER_ID = 'fcfe8161-2e18-4e97-aea4-92afb3ef6826';
const REGION = '서울시 강남구';
const ORDER_ID = 'test_order_' + Date.now();

let testPassed = 0;

// 파트너 소켓 이벤트
partnerSocket.on('connect', () => {
  console.log('1️⃣ 파트너 소켓 연결');
  testPassed++;
  partnerSocket.emit('partner:register', { partner_id: PARTNER_ID });
});

partnerSocket.on('partner:registered', (data) => {
  console.log('2️⃣ 파트너 등록 완료');
  testPassed++;
});

partnerSocket.on('order:incoming', (data) => {
  console.log('3️⃣ 파트너가 콜 수신:', data.product_name);
  testPassed++;
  
  setTimeout(() => {
    console.log('4️⃣ 파트너가 콜 수락...');
    partnerSocket.emit('order:accept', {
      order_id: data.order_id,
      partner_id: PARTNER_ID
    });
  }, 1000);
});

partnerSocket.on('order:assigned', (data) => {
  console.log('5️⃣ 파트너 주문 배정:', data.message);
  testPassed++;
});

// 고객 소켓 이벤트
customerSocket.on('connect', () => {
  console.log('고객 소켓 연결');
  customerSocket.emit('customer:register', {
    customer_id: CUSTOMER_ID,
    region: REGION
  });
});

customerSocket.on('customer:registered', () => {
  console.log('고객 등록 완료');
  testPassed++;
  
  setTimeout(() => {
    console.log('\n📞 고객이 콜 발신...');
    customerSocket.emit('order:call', {
      order_id: ORDER_ID,
      customer_id: CUSTOMER_ID,
      recipient_name: '테스트고객',
      delivery_address: '서울시 강남구',
      delivery_place: '강남역',
      product_name: '축하화환',
      price: 59000,
      region: REGION
    });
  }, 500);
});

customerSocket.on('order:call_sent', () => {
  console.log('6️⃣ 고객에게 발신 완료 알림');
  testPassed++;
});

customerSocket.on('order:accepted', () => {
  console.log('7️⃣ 고객에게 파트너 수락 알림');
  testPassed++;
});

// 타임아웃
setTimeout(() => {
  console.log('\n=== 📊 테스트 결과 ===');
  console.log(`✅ 성공 이벤트: ${testPassed}개`);
  
  if (testPassed >= 6) {
    console.log('\n✅ Socket.io 콜 시스템 작동 완료!');
  }
  
  partnerSocket.disconnect();
  customerSocket.disconnect();
  process.exit(0);
}, 8000);

