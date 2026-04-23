import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';
const NUM_CONCURRENT = 10; // 동시 요청 수
const REQUESTS_PER_USER = 5; // 사용자당 요청 수

interface TestResult {
  endpoint: string;
  method: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: string;
}

const results: TestResult[] = [];

async function measure<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; time: number }> {
  const start = Date.now();
  const result = await fn();
  const time = Date.now() - start;
  return { result, time };
}

// ============================================================
// 인증 테스트
// ============================================================

async function testAuthFlow(): Promise<any> {
  console.log('\n📍 1단계: 인증 API 부하 테스트\n');

  const authResults = {
    register: { times: [] as number[], errors: 0 },
    login: { times: [] as number[], errors: 0 },
    refresh: { times: [] as number[], errors: 0 },
  };

  const users: { email: string; password: string; tokens?: { access: string; refresh: string } }[] = [];

  // 회원가입 - 병렬 처리
  console.log(`  회원가입 (${NUM_CONCURRENT}명 동시)...`);
  const registerPromises = [];
  for (let i = 0; i < NUM_CONCURRENT; i++) {
    registerPromises.push(
      measure('register', async () => {
        try {
          const email = `load-test-${Date.now()}-${i}@test.com`;
          const response = await axios.post(`${API_URL}/auth/register`, {
            email,
            password: 'Test@1234',
            name: `Test User ${i}`,
            phone: `010-0000-${String(i).padStart(4, '0')}`,
            role: 'customer',
          });
          users.push({ email, password: 'Test@1234' });
          return response.data;
        } catch (error: any) {
          authResults.register.errors++;
          throw error;
        }
      })
    );
  }

  const registerResults = await Promise.allSettled(registerPromises);
  registerResults.forEach((r) => {
    if (r.status === 'fulfilled') {
      authResults.register.times.push(r.value.time);
    }
  });

  console.log(`     ✅ 완료 (성공: ${NUM_CONCURRENT - authResults.register.errors}, 실패: ${authResults.register.errors})`);

  // 로그인 - 반복 요청
  console.log(`  로그인 (${NUM_CONCURRENT * REQUESTS_PER_USER}번)...`);
  for (let req = 0; req < REQUESTS_PER_USER; req++) {
    const loginPromises = users.slice(0, NUM_CONCURRENT).map((user) =>
      measure('login', async () => {
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email: user.email,
            password: user.password,
          });
          user.tokens = {
            access: response.data.data.accessToken,
            refresh: response.data.data.refreshToken,
          };
          return response.data;
        } catch (error: any) {
          authResults.login.errors++;
          throw error;
        }
      })
    );

    const loginResults = await Promise.allSettled(loginPromises);
    loginResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        authResults.login.times.push(r.value.time);
      }
    });
  }

  console.log(`     ✅ 완료 (성공: ${authResults.login.times.length}, 실패: ${authResults.login.errors})`);

  // Refresh Token - 반복 요청
  console.log(`  토큰 갱신 (${NUM_CONCURRENT}번)...`);
  const refreshPromises = users.slice(0, NUM_CONCURRENT).map((user) =>
    measure('refresh', async () => {
      try {
        if (!user.tokens) throw new Error('No tokens');
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: user.tokens.refresh,
        });
        user.tokens.access = response.data.data.accessToken;
        return response.data;
      } catch (error: any) {
        authResults.refresh.errors++;
        throw error;
      }
    })
  );

  const refreshResults = await Promise.allSettled(refreshPromises);
  refreshResults.forEach((r) => {
    if (r.status === 'fulfilled') {
      authResults.refresh.times.push(r.value.time);
    }
  });

  console.log(`     ✅ 완료 (성공: ${authResults.refresh.times.length}, 실패: ${authResults.refresh.errors})`);

  // 결과 저장
  const recordResult = (endpoint: string, method: string, times: number[], errors: number) => {
    if (times.length === 0) return;
    const total = times.length + errors;
    results.push({
      endpoint,
      method,
      totalRequests: total,
      successCount: times.length,
      failureCount: errors,
      avgResponseTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minResponseTime: Math.min(...times),
      maxResponseTime: Math.max(...times),
      errorRate: `${((errors / total) * 100).toFixed(2)}%`,
    });
  };

  recordResult('/auth/register', 'POST', authResults.register.times, authResults.register.errors);
  recordResult('/auth/login', 'POST', authResults.login.times, authResults.login.errors);
  recordResult('/auth/refresh', 'POST', authResults.refresh.times, authResults.refresh.errors);

  return users;
}

// ============================================================
// 주문 API 테스트
// ============================================================

async function testOrderFlow(users: any[]): Promise<void> {
  console.log('\n📍 2단계: 주문 API 부하 테스트\n');

  if (users.length === 0) {
    console.log('  ⚠️  테스트 사용자가 없습니다. 스킵합니다.');
    return;
  }

  const orderResults = {
    create: { times: [] as number[], errors: 0 },
    get: { times: [] as number[], errors: 0 },
  };

  const testUser = users[0];
  if (!testUser.tokens) {
    console.log('  ⚠️  토큰이 없습니다. 스킵합니다.');
    return;
  }

  const headers = { Authorization: `Bearer ${testUser.tokens.access}` };

  // 주문 생성 - 병렬
  console.log(`  주문 생성 (${NUM_CONCURRENT}개 동시)...`);
  const createPromises = [];
  for (let i = 0; i < NUM_CONCURRENT; i++) {
    createPromises.push(
      measure('create-order', async () => {
        try {
          const response = await axios.post(
            `${API_URL}/orders`,
            {
              product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab', // 기존 상품 ID
              recipient_name: `Test Recipient ${i}`,
              delivery_place: 'Test Hall',
              delivery_address: 'Seoul, Korea',
              delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
            },
            { headers }
          );
          return response.data;
        } catch (error: any) {
          orderResults.create.errors++;
          throw error;
        }
      })
    );
  }

  const createResults = await Promise.allSettled(createPromises);
  const createdOrderIds: string[] = [];
  createResults.forEach((r) => {
    if (r.status === 'fulfilled') {
      orderResults.create.times.push(r.value.time);
      createdOrderIds.push(r.value.result.data?.data?.id);
    }
  });

  console.log(`     ✅ 완료 (성공: ${createdOrderIds.length}, 실패: ${orderResults.create.errors})`);

  // 주문 조회 - 반복
  console.log(`  주문 목록 조회 (${NUM_CONCURRENT}번)...`);
  for (let req = 0; req < NUM_CONCURRENT; req++) {
    const getPromises = [];
    for (let i = 0; i < Math.min(5, createdOrderIds.length); i++) {
      getPromises.push(
        measure('get-orders', async () => {
          try {
            const response = await axios.get(`${API_URL}/orders`, { headers });
            return response.data;
          } catch (error: any) {
            orderResults.get.errors++;
            throw error;
          }
        })
      );
    }

    const getResults = await Promise.allSettled(getPromises);
    getResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        orderResults.get.times.push(r.value.time);
      }
    });
  }

  console.log(`     ✅ 완료 (성공: ${orderResults.get.times.length}, 실패: ${orderResults.get.errors})`);

  // 결과 저장
  const recordResult = (endpoint: string, method: string, times: number[], errors: number) => {
    if (times.length === 0) return;
    const total = times.length + errors;
    results.push({
      endpoint,
      method,
      totalRequests: total,
      successCount: times.length,
      failureCount: errors,
      avgResponseTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minResponseTime: Math.min(...times),
      maxResponseTime: Math.max(...times),
      errorRate: `${((errors / total) * 100).toFixed(2)}%`,
    });
  };

  recordResult('/orders', 'POST', orderResults.create.times, orderResults.create.errors);
  recordResult('/orders', 'GET', orderResults.get.times, orderResults.get.errors);
}

// ============================================================
// 메인 테스트 실행
// ============================================================

async function runLoadTest() {
  console.log('🚀 API 부하 테스트 시작\n');
  console.log(`📊 테스트 설정:`);
  console.log(`   - 동시 요청 수: ${NUM_CONCURRENT}`);
  console.log(`   - 사용자당 요청 수: ${REQUESTS_PER_USER}`);
  console.log(`   - 총 예상 요청: ~${NUM_CONCURRENT * (REQUESTS_PER_USER + 1) + NUM_CONCURRENT * 2}`);

  try {
    const users = await testAuthFlow();
    await testOrderFlow(users);

    // ============================================================
    // 최종 결과 보고
    // ============================================================

    console.log(`\n\n📊 부하 테스트 최종 결과\n${'='.repeat(80)}\n`);

    console.table(
      results.map((r) => ({
        '엔드포인트': r.endpoint,
        '메서드': r.method,
        '총': r.totalRequests,
        '성공': r.successCount,
        '실패': r.failureCount,
        '에러율': r.errorRate,
        '최소(ms)': r.minResponseTime,
        '최대(ms)': r.maxResponseTime,
        '평균(ms)': r.avgResponseTime,
      }))
    );

    let totalSuccess = 0;
    let totalFailure = 0;
    let totalRequests = 0;

    results.forEach((r) => {
      totalSuccess += r.successCount;
      totalFailure += r.failureCount;
      totalRequests += r.totalRequests;
    });

    console.log('\n' + '='.repeat(80));
    const successRate = ((totalSuccess / totalRequests) * 100).toFixed(2);
    console.log(`합계: 총 ${totalRequests}개 요청 | 성공 ${totalSuccess}개 | 실패 ${totalFailure}개 | 성공률 ${successRate}%\n`);

    // 성능 평가
    console.log('📈 성능 평가:');
    const slowEndpoints = results.filter((r) => r.avgResponseTime > 500);
    if (slowEndpoints.length > 0) {
      console.log(`  ⚠️  느린 엔드포인트 (평균 > 500ms):`);
      slowEndpoints.forEach((r) => {
        console.log(`     - ${r.endpoint}: ${r.avgResponseTime}ms`);
      });
    } else {
      console.log(`  ✅ 모든 엔드포인트가 500ms 이하 (양호)`);
    }

    const failedTests = results.filter((r) => r.failureCount > 0);
    if (failedTests.length > 0) {
      console.log(`  ⚠️  실패한 테스트:`);
      failedTests.forEach((r) => {
        console.log(`     - ${r.endpoint}: ${r.failureCount}개 실패`);
      });
    } else {
      console.log(`  ✅ 모든 테스트 성공`);
    }

    console.log(`\n${'='.repeat(80)}\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 부하 테스트 오류:', error.message);
    process.exit(1);
  }
}

runLoadTest();
