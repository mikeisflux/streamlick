import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdmin() {
  try {
    // Get email from command line argument or use default
    const targetEmail = process.argv[2] || 'divinitycomicsinc@gmail.com';

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    console.log('Current users:');
    users.forEach((user: { id: string; email: string; role: string }) => {
      console.log(`  - ${user.email} (${user.role})`);
    });

    if (users.length === 0) {
      console.log('\nNo users found in database.');
      return;
    }

    // Find user by email
    const targetUser = users.find(u => u.email === targetEmail);

    if (!targetUser) {
      console.log(`\n❌ User with email ${targetEmail} not found.`);
      console.log('Available users:');
      users.forEach((user: { id: string; email: string; role: string }) => {
        console.log(`  - ${user.email}`);
      });
      return;
    }

    // Set user as admin
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: 'admin' },
    });

    console.log(`\n✅ Set ${targetUser.email} as admin`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();
