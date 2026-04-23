import prisma from './src/config/database';

async function main() {
  try {
    const order = await prisma.order.update({
      where: { id: '94dcace8-ef70-4ac1-bb4c-6a4d3a9f09b8' },
      data: { status: 'PENDING' }
    });
    console.log('✅ 주문 상태 업데이트:', order.status);
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
