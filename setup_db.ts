import prisma from './src/config/database';
import bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  try {
    // admin 사용자 생성
    const hashedPassword = await bcrypt.hash('Admin@1234', 10);
    const admin = await prisma.user.create({
      data: {
        role: 'admin',
        name: '꽃담 관리자',
        email: 'admin@flowerdam.com',
        password: hashedPassword,
        phone: '01000000000',
        status: 'ACTIVE',
      },
    });
    console.log('✅ Admin 사용자 생성:', admin.id);

    // 상품 생성
    const product = await prisma.product.create({
      data: {
        name: '근조화환',
        description: '깊고 고상한 색상의 근조화환',
        price: new Decimal('59000'),
        category: '근조화환',
      },
    });
    console.log('✅ 샘플 상품 생성:', product.id);

    console.log('✅ DB 초기화 완료');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('ℹ️ 이미 존재하는 데이터입니다');
    } else {
      console.error('❌ 에러:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
