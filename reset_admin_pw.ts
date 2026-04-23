import prisma from './src/config/database';
import bcrypt from 'bcrypt';

async function main() {
  try {
    const hashedPassword = await bcrypt.hash('Admin@1234', 10);
    console.log('생성된 해시:', hashedPassword);
    
    const admin = await prisma.user.update({
      where: { email: 'admin@flowerdam.com' },
      data: { password: hashedPassword }
    });
    console.log('✅ Admin 비밀번호 재설정 완료');
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
