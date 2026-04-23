import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 12);

  const admin = await prisma.user.upsert({
    where: { phone: '01000000000' },
    update: {},
    create: {
      name: '꽃담 관리자',
      phone: '01000000000',
      email: 'admin@flowerdam.com',
      passwordHash,
      role: UserRole.ADMIN,
      isApproved: true,
      wallet: { create: { balance: 0 } },
    },
  });

  // 테스트 고객
  const customerHash = await bcrypt.hash('test1234', 12);
  const customer = await prisma.user.upsert({
    where: { phone: '01011111111' },
    update: {},
    create: {
      name: '테스트 고객',
      phone: '01011111111',
      passwordHash: customerHash,
      role: UserRole.CUSTOMER,
      isApproved: true,
      wallet: { create: { balance: 50000 } },
    },
  });

  // 테스트 화원
  const partnerHash = await bcrypt.hash('test1234', 12);
  const partner = await prisma.user.upsert({
    where: { phone: '01022222222' },
    update: {},
    create: {
      name: '김화원',
      phone: '01022222222',
      passwordHash: partnerHash,
      role: UserRole.PARTNER_OWNER,
      businessName: '꽃피는 화원',
      address: '서울시 강남구 테헤란로 123',
      region: '서울',
      isApproved: true,
      wallet: { create: { balance: 120000 } },
    },
  });

  // 테스트 셀러
  const sellerHash = await bcrypt.hash('test1234', 12);
  const seller = await prisma.user.upsert({
    where: { phone: '01033333333' },
    update: {},
    create: {
      name: '이셀러',
      phone: '01033333333',
      passwordHash: sellerHash,
      role: UserRole.SELLER,
      referralCode: 'SELLER001',
      isApproved: true,
      wallet: { create: { balance: 30000 } },
    },
  });
  await prisma.sellerProfile.upsert({
    where: { userId: seller.id },
    update: {},
    create: {
      userId: seller.id,
      referralCode: 'SELLER001',
      referralLink: 'http://localhost:3000/order?ref=SELLER001',
    },
  });

  // 테스트 가맹점 직원
  const staffHash = await bcrypt.hash('test1234', 12);
  await prisma.user.upsert({
    where: { phone: '01044444444' },
    update: {},
    create: {
      name: '박직원',
      phone: '01044444444',
      passwordHash: staffHash,
      role: UserRole.PARTNER_STAFF,
      ownerId: partner.id,
      isApproved: true,
      wallet: { create: { balance: 0 } },
    },
  });

  // 테스트 주문 3개
  const orders = [
    {
      customerId: customer.id,
      partnerId: partner.id,
      recipientName: '박고객',
      recipientPhone: '01099999999',
      deliveryAddress: '서울시 서초구 반포대로 123 서울성모병원',
      deliveryRegion: '서울',
      productName: '근조화환 (중)',
      price: 79000,
      status: 'CONFIRMED' as const,
      sellerAmount: 11850,
      partnerAmount: 44240,
      platformAmount: 23910 - 2607,
      pgFee: 2607,
      completionPhoto: null,
    },
    {
      customerId: customer.id,
      partnerId: partner.id,
      recipientName: '최수신',
      recipientPhone: '01088888888',
      deliveryAddress: '서울시 강남구 삼성동 123 삼성서울병원',
      deliveryRegion: '서울',
      productName: '근조화환 (소)',
      price: 59000,
      status: 'DELIVERING' as const,
      sellerAmount: 8850,
      partnerAmount: 33040,
      platformAmount: 17110 - 1947,
      pgFee: 1947,
      completionPhoto: null,
    },
    {
      customerId: customer.id,
      partnerId: null,
      recipientName: '정수취',
      recipientPhone: '01077777777',
      deliveryAddress: '서울시 마포구 합정동 456',
      deliveryRegion: '서울',
      productName: '축하화환 (대)',
      price: 89000,
      status: 'CALLING' as const,
      sellerAmount: null,
      partnerAmount: null,
      platformAmount: null,
      pgFee: null,
      completionPhoto: null,
    },
  ];

  for (const orderData of orders) {
    await prisma.order.create({ data: orderData });
  }

  console.log('✅ 시드 완료');
  console.log('관리자: 01000000000 / admin1234');
  console.log('고객:   01011111111 / test1234');
  console.log('화원:   01022222222 / test1234');
  console.log('셀러:   01033333333 / test1234');
  console.log('직원:   01044444444 / test1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
