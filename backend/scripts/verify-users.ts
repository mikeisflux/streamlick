import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAllUsers() {
  try {
    console.log('Marking all unverified users as verified...');

    const result = await prisma.user.updateMany({
      where: {
        emailVerified: false,
      },
      data: {
        emailVerified: true,
      },
    });

    console.log(`✅ Successfully verified ${result.count} users`);

    // Show all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        role: true,
      },
    });

    console.log('\nAll users:');
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'No name'}) - ${user.emailVerified ? '✓ Verified' : '✗ Unverified'} - ${user.role}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error verifying users:', error);
    process.exit(1);
  }
}

verifyAllUsers();
