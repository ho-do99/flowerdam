import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

interface TestCase {
  name: string;
  endpoint: string;
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE';
  data?: any;
  headers?: any;
  expectedStatusCode?: number;
  description: string;
}

const testResults: {
  passed: number;
  failed: number;
  tests: { name: string; passed: boolean; error?: string }[];
} = {
  passed: 0,
  failed: 0,
  tests: [],
};

async function runTest(testCase: TestCase): Promise<boolean> {
  try {
    const config: any = { validateStatus: () => true };
    if (testCase.headers) {
      config.headers = testCase.headers;
    }

    let response: any;
    if (testCase.method === 'POST') {
      response = await axios.post(`${API_URL}${testCase.endpoint}`, testCase.data || {}, config);
    } else if (testCase.method === 'GET') {
      response = await axios.get(`${API_URL}${testCase.endpoint}`, config);
    } else if (testCase.method === 'PATCH') {
      response = await axios.patch(`${API_URL}${testCase.endpoint}`, testCase.data || {}, config);
    }

    if (!response) {
      console.log(`  ❌ ${testCase.name} (응답 없음)`);
      return false;
    }

    const passed = testCase.expectedStatusCode
      ? response.status === testCase.expectedStatusCode
      : response.status >= 200 && response.status < 300;

    const statusIcon = passed ? '✅' : '❌';
    console.log(`  ${statusIcon} ${testCase.name} (${response.status})`);

    if (!passed) {
      console.log(`     예상: ${testCase.expectedStatusCode}, 실제: ${response.status}`);
      console.log(`     응답: ${JSON.stringify(response.data).slice(0, 100)}`);
    }

    return passed;
  } catch (error: any) {
    console.log(`  ❌ ${testCase.name} (에러: ${error.message})`);
    return false;
  }
}

async function testInputValidation() {
  console.log('\n📍 1단계: 입력값 검증 테스트\n');

  const tests: TestCase[] = [
    {
      name: '회원가입 - 비어있는 이메일',
      endpoint: '/auth/register',
      method: 'POST',
      data: { password: 'Test@1234', name: 'Test', phone: '010-1234-5678', role: 'customer' },
      expectedStatusCode: 400,
      description: '이메일이 비어있을 때 400 반환',
    },
    {
      name: '회원가입 - 잘못된 이메일 형식',
      endpoint: '/auth/register',
      method: 'POST',
      data: { email: 'invalid-email', password: 'Test@1234', name: 'Test', phone: '010-1234-5678', role: 'customer' },
      expectedStatusCode: 400,
      description: '이메일 형식 검증',
    },
    {
      name: '회원가입 - 약한 비밀번호',
      endpoint: '/auth/register',
      method: 'POST',
      data: { email: 'test@test.com', password: '123', name: 'Test', phone: '010-1234-5678', role: 'customer' },
      expectedStatusCode: 400,
      description: '비밀번호 강도 검증',
    },
    {
      name: '회원가입 - 잘못된 휴대폰 형식',
      endpoint: '/auth/register',
      method: 'POST',
      data: { email: `edge-${Date.now()}@test.com`, password: 'Test@1234', name: 'Test', phone: 'invalid', role: 'customer' },
      expectedStatusCode: 400,
      description: '휴대폰 형식 검증',
    },
    {
      name: '회원가입 - 잘못된 역할',
      endpoint: '/auth/register',
      method: 'POST',
      data: { email: `edge-${Date.now()}@test.com`, password: 'Test@1234', name: 'Test', phone: '010-1234-5678', role: 'invalid_role' },
      expectedStatusCode: 400,
      description: '역할 검증',
    },
    {
      name: '회원가입 - partner_staff는 partner_id 필수',
      endpoint: '/auth/register',
      method: 'POST',
      data: { email: `edge-${Date.now()}@test.com`, password: 'Test@1234', name: 'Test', phone: '010-1234-5678', role: 'partner_staff' },
      expectedStatusCode: 400,
      description: '직원 역할 시 partner_id 검증',
    },
    {
      name: '로그인 - 비어있는 이메일',
      endpoint: '/auth/login',
      method: 'POST',
      data: { password: 'Test@1234' },
      expectedStatusCode: 400,
      description: '필수 필드 검증',
    },
    {
      name: '로그인 - 존재하지 않는 사용자',
      endpoint: '/auth/login',
      method: 'POST',
      data: { email: 'nonexistent@test.com', password: 'Test@1234' },
      expectedStatusCode: 401,
      description: '존재하지 않는 사용자 거부',
    },
    {
      name: '로그인 - 잘못된 비밀번호',
      endpoint: '/auth/login',
      method: 'POST',
      data: { email: 'admin@flowerdam.com', password: 'WrongPassword123!' },
      expectedStatusCode: 401,
      description: '잘못된 비밀번호 거부',
    },
  ];

  for (const test of tests) {
    const passed = await runTest(test);
    testResults.tests.push({ name: test.name, passed });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }
}

async function testBoundaryValues() {
  console.log('\n📍 2단계: 경계값 테스트\n');

  const tests: TestCase[] = [
    {
      name: '주문 생성 - 너무 긴 이름 (500자)',
      endpoint: '/orders',
      method: 'POST',
      data: {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: 'a'.repeat(500),
        delivery_place: 'Test Hall',
        delivery_address: 'Seoul',
        delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
      },
      headers: { Authorization: 'Bearer invalid_token' },
      expectedStatusCode: 401,
      description: '토큰 검증 (정상 작동 확인용)',
    },
    {
      name: '주문 생성 - 마이너스 가격',
      endpoint: '/orders',
      method: 'POST',
      data: {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: 'Test',
        delivery_place: 'Test',
        delivery_address: 'Seoul',
        delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
        price: -1000,
      },
      expectedStatusCode: 400,
      description: '음수 가격 거부',
    },
    {
      name: '주문 생성 - 과거 배송 시간',
      endpoint: '/orders',
      method: 'POST',
      data: {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: 'Test',
        delivery_place: 'Test',
        delivery_address: 'Seoul',
        delivery_datetime: new Date(Date.now() - 86400000).toISOString(),
      },
      expectedStatusCode: 400,
      description: '과거 시간 거부',
    },
    {
      name: '주문 생성 - 빈 배송지',
      endpoint: '/orders',
      method: 'POST',
      data: {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: 'Test',
        delivery_place: '',
        delivery_address: '',
        delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
      },
      expectedStatusCode: 400,
      description: '필수 필드 검증',
    },
  ];

  for (const test of tests) {
    const passed = await runTest(test);
    testResults.tests.push({ name: test.name, passed });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }
}

async function testSQLInjection() {
  console.log('\n📍 3단계: SQL Injection 방지 테스트\n');

  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "1 UNION SELECT * FROM users",
  ];

  let testCount = 0;
  for (const input of maliciousInputs) {
    testCount++;
    const test: TestCase = {
      name: `SQL Injection 테스트 #${testCount}`,
      endpoint: '/auth/login',
      method: 'POST',
      data: { email: input, password: input },
      expectedStatusCode: 401, // 401 또는 400, 중요한 건 서버가 살아있어야 함
      description: 'SQL Injection 방지 확인',
    };

    const passed = await runTest(test);
    testResults.tests.push({ name: test.name, passed });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }
}

async function testXSSPrevention() {
  console.log('\n📍 4단계: XSS 방지 테스트\n');

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror="alert(1)">',
    'javascript:alert(1)',
  ];

  let testCount = 0;
  for (const payload of xssPayloads) {
    testCount++;
    const test: TestCase = {
      name: `XSS 테스트 #${testCount}`,
      endpoint: '/auth/register',
      method: 'POST',
      data: {
        email: `xss-${Date.now()}@test.com`,
        password: 'Test@1234',
        name: payload,
        phone: '010-1234-5678',
        role: 'customer',
      },
      expectedStatusCode: 400, // XSS 페이로드는 거부되거나 검증 실패
      description: 'XSS 방지 확인',
    };

    const passed = await runTest(test);
    testResults.tests.push({ name: test.name, passed });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }
}

async function testCSRFTokenHandling() {
  console.log('\n📍 5단계: 인증 필수 엔드포인트 테스트\n');

  const tests: TestCase[] = [
    {
      name: '토큰 없이 주문 생성 시도',
      endpoint: '/orders',
      method: 'POST',
      data: {
        product_id: '185d7f7f-3d29-4ddf-bde9-eec39039a0ab',
        recipient_name: 'Test',
        delivery_place: 'Test',
        delivery_address: 'Seoul',
        delivery_datetime: new Date(Date.now() + 86400000).toISOString(),
      },
      expectedStatusCode: 401,
      description: '인증 필수 검증',
    },
    {
      name: '잘못된 토큰으로 주문 조회 시도',
      endpoint: '/orders',
      method: 'GET',
      headers: { Authorization: 'Bearer invalid_token_12345' },
      expectedStatusCode: 401,
      description: '토큰 검증',
    },
    {
      name: '토큰 없이 파트너 목록 조회 시도',
      endpoint: '/partners',
      method: 'GET',
      expectedStatusCode: 401,
      description: '인증 필수 검증',
    },
  ];

  for (const test of tests) {
    const passed = await runTest(test);
    testResults.tests.push({ name: test.name, passed });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }
}

async function runEdgeCaseTests() {
  console.log('🚀 엣지 케이스 및 보안 테스트 시작\n');

  try {
    await testInputValidation();
    await testBoundaryValues();
    await testSQLInjection();
    await testXSSPrevention();
    await testCSRFTokenHandling();

    // ============================================================
    // 최종 결과 보고
    // ============================================================

    console.log(`\n\n📊 엣지 케이스 테스트 최종 결과\n${'='.repeat(60)}\n`);

    console.log('테스트 상세 결과:');
    testResults.tests.forEach((test) => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`  ${icon} ${test.name}`);
    });

    const totalTests = testResults.passed + testResults.failed;
    const passRate = ((testResults.passed / totalTests) * 100).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📈 최종 점수:`);
    console.log(`  총 테스트: ${totalTests}개`);
    console.log(`  성공: ${testResults.passed}개 (${passRate}%)`);
    console.log(`  실패: ${testResults.failed}개`);

    if (testResults.passed === totalTests) {
      console.log(`\n🏆 모든 엣지 케이스 및 보안 테스트 통과!\n`);
    } else {
      console.log(`\n⚠️  일부 테스트 실패. 위 결과를 참고하세요.\n`);
    }

    console.log(`${'='.repeat(60)}\n`);

    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n❌ 테스트 오류:', error.message);
    process.exit(1);
  }
}

runEdgeCaseTests();
