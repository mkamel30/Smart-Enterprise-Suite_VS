const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding Super Admin...');

    try {
        // 1. Create a Default Branch (Required for users in this system)
        let branch = await prisma.branch.findUnique({
            where: { code: 'MAIN_OFFICE' }
        });

        if (!branch) {
            branch = await prisma.branch.create({
                data: {
                    code: 'MAIN_OFFICE',
                    name: 'الإدارة العامة',
                    type: 'BRANCH',
                    address: 'Main HQ'
                }
            });
            console.log('✅ Created Main Branch:', branch.id);
        }

        // 2. Create Super Admin User
        const email = 'admin@smart.com';
        const password = 'Admin@12345678'; // Meets policy: 12+ chars, Upper, Lower, Number, Special
        const hashedPassword = await bcrypt.hash(password, 12);

        // Use findFirst + create/update instead of upsert to avoid Unique constraint requirement
        let user = await prisma.user.findFirst({
            where: { email: email }
        });

        if (user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    isActive: true,
                    branchId: branch.id
                }
            });
            console.log('✅ Updated existing Admin user');
        } else {
            user = await prisma.user.create({
                data: {
                    email: email,
                    displayName: 'Super Admin',
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    isActive: true,
                    branchId: branch.id,
                    mustChangePassword: false
                }
            });
            console.log('✅ Created new Admin user');
        }

        console.log('--- Super Admin Credentials ---');
        console.log('Email:   ', email);
        console.log('Password:', password);
        console.log('Role:    ', user.role);
        console.log('Branch:  ', branch.name);
        console.log('-------------------------------');
        console.log('✅ Admin user is ready. Please log in.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
