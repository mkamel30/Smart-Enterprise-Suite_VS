const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createAdmin() {
    try {
        console.log('🔧 Creating admin user...\n');

        // First, ensure IT branch exists
        let adminBranch = await prisma.branch.findFirst({
            where: { code: 'IT001' }
        });

        if (!adminBranch) {
            adminBranch = await prisma.branch.create({
                data: {
                    code: 'IT001',
                    name: 'إدارة نظم المعلومات (IT)',
                    type: 'CENTRAL',
                    isActive: true,
                    address: 'Main Office - IT Dept'
                }
            });
            console.log('✅ IT branch created');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash('Admin@12345678', 10);

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: { email: 'admin@csdept.com' }
        });

        if (existingUser) {
            // Update existing user
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    password: hashedPassword,
                    branchId: adminBranch.id,
                    role: 'SUPER_ADMIN',
                    displayName: 'System Administrator'
                }
            });
            console.log('✅ Admin user updated successfully!');
        } else {
            // Create new user
            await prisma.user.create({
                data: {
                    email: 'admin@csdept.com',
                    displayName: 'System Administrator',
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    branchId: adminBranch.id,
                    canDoMaintenance: true
                }
            });
            console.log('✅ Admin user created successfully!');
        }

        console.log('\n📋 Admin Credentials:');
        console.log('   Email:    admin@csdept.com');
        console.log('   Password: Admin@12345678');
        console.log('   Role:     SUPER_ADMIN');
        console.log('   Branch:   IT Department\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
