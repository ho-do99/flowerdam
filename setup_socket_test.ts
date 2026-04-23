import prisma from './src/config/database';

async function setupSocketTest() {
  try {
    console.log('🔧 Socket.io 테스트를 위한 데이터 생성...\n');

    // 1. SEOUL 지역의 활성 파트너 생성 (또는 확인)
    const existingPartners = await prisma.partner.findMany({
      where: { region: 'SEOUL', status: 'ACTIVE' },
    });

    let testPartner;
    if (existingPartners.length > 0) {
      testPartner = existingPartners[0];
      console.log(`✅ 기존 SEOUL 파트너 사용: ${testPartner.id} (${testPartner.name})`);
    } else {
      // 파트너 소유자 사용자 생성
      const ownerUser = await prisma.user.create({
        data: {
          email: `socket-test-owner-${Date.now()}@test.com`,
          password: 'test-password',
          name: 'Socket Test Owner',
          phone: '010-0000-0001',
          role: 'partner_owner',
          status: 'ACTIVE',
        },
      });

      // 파트너 생성
      testPartner = await prisma.partner.create({
        data: {
          owner_id: ownerUser.id,
          name: 'Socket Test Flower Shop',
          region: 'SEOUL',
          address: 'Seoul Test Address',
          business_number: `${Date.now()}-socket-test`,
          status: 'ACTIVE',
          approved_at: new Date(),
        },
      });

      console.log(`✅ 새로운 SEOUL 파트너 생성: ${testPartner.id}`);
    }

    // 2. 테스트용 고객 생성
    const testCustomer = await prisma.user.create({
      data: {
        email: `socket-test-customer-${Date.now()}@test.com`,
        password: 'test-password',
        name: 'Socket Test Customer',
        phone: '010-0000-0002',
        role: 'customer',
        status: 'ACTIVE',
      },
    });

    console.log(`✅ 테스트 고객 생성: ${testCustomer.id}`);

    // 3. 테스트용 상품 생성 (또는 기존 사용)
    let testProduct = await prisma.product.findFirst({
      where: { is_active: true },
    });

    if (!testProduct) {
      testProduct = await prisma.product.create({
        data: {
          name: 'Socket Test Product',
          description: 'Test product for socket.io',
          price: 59000,
          category: '근조화환',
          is_active: true,
        },
      });
      console.log(`✅ 테스트 상품 생성: ${testProduct.id}`);
    } else {
      console.log(`✅ 기존 상품 사용: ${testProduct.id}`);
    }

    // 4. 테스트 주문 생성 (PENDING_PAYMENT 상태)
    const testOrder = await prisma.order.create({
      data: {
        customer_id: testCustomer.id,
        product_id: testProduct.id,
        price: testProduct.price,
        recipient_name: 'Test Recipient',
        delivery_place: 'Test Event Hall',
        delivery_address: '서울시 강남구 테스트로 123',
        delivery_datetime: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
    });

    console.log(`✅ 테스트 주문 생성: ${testOrder.id}`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📋 테스트 정보:\n`);
    console.log(`  파트너 ID: ${testPartner.id}`);
    console.log(`  파트너 지역: ${testPartner.region}`);
    console.log(`  고객 ID: ${testCustomer.id}`);
    console.log(`  상품 ID: ${testProduct.id}`);
    console.log(`  주문 ID: ${testOrder.id}`);
    console.log(`\n위 정보로 socket_test_v2.js를 실행하세요.\n`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error: any) {
    console.error('❌ 설정 오류:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupSocketTest();
