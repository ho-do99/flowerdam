import prisma from './src/config/database';

async function main() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@flowerdam.com' }
    });
    
    if (admin) {
      console.log('✅ Admin 계정 존재:');
      console.log(JSON.stringify({ email: admin.email, role: admin.role, status: admin.status }, null, 2));
    } else {
      console.log('❌ Admin 계정 없음');
    }

    // 모든 사용자 조회
    const users = await prisma.user.findMany();
    console.log(`\n현재 사용자 (${users.length}명):`);
    users.forEach(u => console.log(`- ${u.email} (${u.role}) [${u.status}]`));
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
