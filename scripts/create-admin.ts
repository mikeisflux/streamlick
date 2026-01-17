import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'divinitycomicsinc@gmail.com';
  const password = 'T9qXeWPkfXjM';
  const name = 'Admin';

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create or update the user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email,
      passwordHash,
      name,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created successfully!');
  console.log('Email:', user.email);
  console.log('Role:', user.role);
  console.log('ID:', user.id);
}

main()
  .catch((e) => {
    console.error('Error creating admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
