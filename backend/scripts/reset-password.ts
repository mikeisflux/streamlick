import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Change these values to match your account
  const userEmail = 'divinitycomicsinc@gmail.com'; // Your email
  const newPassword = 'Good2Go!'; // Your new password

  console.log('🔐 Resetting password...');
  console.log(`   Email: ${userEmail}`);

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      console.error(`❌ User not found with email: ${userEmail}`);
      console.log('\n💡 Available users:');
      const allUsers = await prisma.user.findMany({
        select: { email: true, name: true, role: true }
      });
      allUsers.forEach(u => console.log(`   - ${u.email} (${u.name}) - ${u.role}`));
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        emailVerified: true // Mark email as verified
      }
    });

    console.log('✅ Password reset successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`\n✨ You can now log in at /login\n`);

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
