const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const EMAIL = 'a.fakharany@egyptsmartcards.com';
const NEW_PASSWORD = '12345678';

async function reset() {
  try {
    const user = await prisma.user.findFirst({
        where: { email: EMAIL }
    });

    if (!user) {
      console.log('User not found in Main System.');
      return;
    }

    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    console.log(`SUCCESS: Password for ${EMAIL} has been reset to ${NEW_PASSWORD}`);
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
