import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Setting up password authentication...');

  try {
    // Step 1: Add password column if it doesn't exist
    console.log('📝 Adding password column to users table...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password TEXT;
    `);
    console.log('✅ Password column added');

    // Step 2: Delete all existing users
    console.log('🗑️  Deleting all existing users...');
    const deleteResult = await prisma.user.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} users`);

    // Step 3: Create admin user
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('Good2Go!', 10);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@streamlick.local',
        password: hashedPassword,
        name: 'Administrator',
        role: 'admin',
        planType: 'business'
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('\n📋 Admin credentials:');
    console.log('   Email: admin@streamlick.local');
    console.log('   Password: Good2Go!');
    console.log(`   User ID: ${admin.id}`);
    console.log('\n✨ Setup complete! You can now log in at /login\n');

  } catch (error) {
    console.error('❌ Error during setup:', error);
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
