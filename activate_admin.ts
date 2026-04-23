import prisma from './src/config/database';

async function main() {
  try {
    const admin = await prisma.user.update({
      where: { email: 'admin@flowerdam.com' },
      data: { status: 'ACTIVE' }
    });
    console.log('✅ Admin 활성화 완료:', admin.status);
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
