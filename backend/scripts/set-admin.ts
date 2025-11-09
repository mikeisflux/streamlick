import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdmin() {
  try {
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

    // Set first user as admin
    const firstUser = users[0];
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: 'admin' },
    });

    console.log(`\n✅ Set ${firstUser.email} as admin`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();
