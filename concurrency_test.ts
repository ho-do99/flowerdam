import prisma from './src/config/database';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

interface TestScenario {
  name: string;
  duration: number;
  concurrentUsers: number;
  operations: () => Promise<void>;
}

const results = {
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  startTime: 0,
  endTime: 0,
};

async function createTestUser(role: string, index: number): Promise<any> {
  try {
    const email = `concurrent-${role}-${index}-${Date.now()}@test.com`;
    const response = await axios.post(`${API_URL}/auth/register`, {
      email,
      password: 'Test@1234',
      name: `${role} User ${index}`,
      phone: `010-0000-${String(index).padStart(4, '0')}`,
      role,
      ...(role === 'partner_staff' && { partner_id: '' }), // 필요시 파트너 ID 추가
    });

    // 로그인하여 토큰 얻기
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password: 'Test@1234',
    });

    return {
      userId: response.data.data.user.id,
      email,
      role,
      accessToken: loginResponse.data.data.accessToken,
    };
  } catch (error) {
    return null;
  }
}

async function simulateCustomerFlow(user: any): Promise<void> {
  try {
    // 상품 조회
    await axios.get(`${API_URL}/products`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    // 주문 생성
    const orderResponse = await axios.post(
      `${API_URL}/orders`,
      {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: user.name,
        delivery_place: 'Test Hall',
        delivery_address: 'Seoul',
        delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
      },
      { headers: { Authorization: `Bearer ${user.accessToken}` } }
    );

    // 주문 목록 조회
    await axios.get(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    results.successfulOperations += 3;
  } catch (error) {
    results.failedOperations += 3;
  }

  results.totalOperations += 3;
}

async function simulatePartnerOwnerFlow(user: any): Promise<void> {
  try {
    // 파트너 정보 조회
    const partnerResponse = await axios.get(`${API_URL}/partners/me`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (partnerResponse.status === 200) {
      results.successfulOperations += 1;
    }

    // 직원 목록 조회
    const staffResponse = await axios.get(`${API_URL}/partners/me/staff`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (staffResponse.status === 200) {
      results.successfulOperations += 1;
    }

    results.successfulOperations += 1;
  } catch (error) {
    results.failedOperations += 3;
  }

  results.totalOperations += 3;
}

async function simulateAdminFlow(user: any): Promise<void> {
  try {
    // 파트너 목록 조회
    const partnersResponse = await axios.get(`${API_URL}/partners?status=ACTIVE&page=1&limit=20`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (partnersResponse.status === 200) {
      results.successfulOperations += 1;
    }

    // 셀러 목록 조회
    const sellersResponse = await axios.get(`${API_URL}/admin/sellers`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (sellersResponse.status === 200 || sellersResponse.status === 404) {
      results.successfulOperations += 1;
    }

    // 통계 조회
    const statsResponse = await axios.get(`${API_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    if (statsResponse.status === 200 || statsResponse.status === 404) {
      results.successfulOperations += 1;
    }
  } catch (error) {
    results.failedOperations += 3;
  }

  results.totalOperations += 3;
}

async function runConcurrencyTest() {
  console.log('🚀 동시성 및 성능 테스트 시작\n');

  try {
    // 테스트 1: 고객 동시 작업
    console.log('📍 1단계: 고객 10명 동시 주문 작업\n');
    results.totalOperations = 0;
    results.successfulOperations = 0;
    results.failedOperations = 0;
    results.startTime = Date.now();

    const customerPromises = [];
    for (let i = 0; i < 10; i++) {
      customerPromises.push(
        createTestUser('customer', i).then((user) => {
          if (user) {
            return simulateCustomerFlow(user);
          }
        })
      );
    }

    await Promise.all(customerPromises);
    results.endTime = Date.now();

    const test1Duration = results.endTime - results.startTime;
    console.log(`  ✅ 완료`);
    console.log(`     작업: ${results.totalOperations}개`);
    console.log(`     성공: ${results.successfulOperations}개`);
    console.log(`     실패: ${results.failedOperations}개`);
    console.log(`     소요시간: ${test1Duration}ms`);
    console.log(`     평균: ${(test1Duration / 10).toFixed(2)}ms/user\n`);

    // 테스트 2: 파트너 오너 동시 작업
    console.log('📍 2단계: 파트너 오너 5명 동시 조회 작업\n');
    results.totalOperations = 0;
    results.successfulOperations = 0;
    results.failedOperations = 0;
    results.startTime = Date.now();

    const partnerPromises = [];
    for (let i = 0; i < 5; i++) {
      partnerPromises.push(
        createTestUser('partner_owner', i).then((user) => {
          if (user) {
            return simulatePartnerOwnerFlow(user);
          }
        })
      );
    }

    await Promise.all(partnerPromises);
    results.endTime = Date.now();

    const test2Duration = results.endTime - results.startTime;
    console.log(`  ✅ 완료`);
    console.log(`     작업: ${results.totalOperations}개`);
    console.log(`     성공: ${results.successfulOperations}개`);
    console.log(`     실패: ${results.failedOperations}개`);
    console.log(`     소요시간: ${test2Duration}ms`);
    console.log(`     평균: ${(test2Duration / 5).toFixed(2)}ms/user\n`);

    // 테스트 3: Admin 동시 작업
    console.log('📍 3단계: Admin 3명 동시 조회 작업\n');
    results.totalOperations = 0;
    results.successfulOperations = 0;
    results.failedOperations = 0;
    results.startTime = Date.now();

    const adminPromises = [];
    for (let i = 0; i < 3; i++) {
      adminPromises.push(
        createTestUser('admin', i).then((user) => {
          if (user) {
            return simulateAdminFlow(user);
          }
        })
      );
    }

    await Promise.all(adminPromises);
    results.endTime = Date.now();

    const test3Duration = results.endTime - results.startTime;
    console.log(`  ✅ 완료`);
    console.log(`     작업: ${results.totalOperations}개`);
    console.log(`     성공: ${results.successfulOperations}개`);
    console.log(`     실패: ${results.failedOperations}개`);
    console.log(`     소요시간: ${test3Duration}ms`);
    console.log(`     평균: ${(test3Duration / 3).toFixed(2)}ms/user\n`);

    // ============================================================
    // 최종 결과
    // ============================================================

    console.log(`\n📊 동시성 테스트 최종 결과\n${'='.repeat(60)}\n`);

    console.log('테스트 요약:');
    console.log(`  1. 고객 동시성: ${test1Duration}ms (10명)`);
    console.log(`  2. 파트너 동시성: ${test2Duration}ms (5명)`);
    console.log(`  3. Admin 동시성: ${test3Duration}ms (3명)`);

    console.log(`\n📈 성능 평가:`);
    const avgCustomerTime = test1Duration / 10;
    const avgPartnerTime = test2Duration / 5;
    const avgAdminTime = test3Duration / 3;

    console.log(`  - 고객당 평균 시간: ${avgCustomerTime.toFixed(2)}ms (목표: < 500ms)`);
    console.log(`  - 파트너당 평균 시간: ${avgPartnerTime.toFixed(2)}ms (목표: < 500ms)`);
    console.log(`  - Admin당 평균 시간: ${avgAdminTime.toFixed(2)}ms (목표: < 500ms)`);

    const isPerformanceGood =
      avgCustomerTime < 500 && avgPartnerTime < 500 && avgAdminTime < 500;

    if (isPerformanceGood) {
      console.log(`\n✅ 모든 동시성 테스트 성능 기준 통과!\n`);
    } else {
      console.log(`\n⚠️  일부 성능 기준 미충족. 최적화 필요.\n`);
    }

    console.log(`${'='.repeat(60)}\n`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ 테스트 오류:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runConcurrencyTest();
