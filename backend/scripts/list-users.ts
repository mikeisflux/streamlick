import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📋 Listing all users in database...\n');

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        planType: true,
        password: true,
        emailVerified: true,
        createdAt: true,
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database!\n');
      return;
    }

    console.log(`Found ${users.length} user(s):\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. User Details:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Plan: ${user.planType}`);
      console.log(`   Has Password: ${user.password ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   Email Verified: ${user.emailVerified ? 'YES' : 'NO'}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error listing users:', error);
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
