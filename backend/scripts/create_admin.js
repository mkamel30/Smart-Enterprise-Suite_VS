const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createAdmin() {
    try {
        console.log('🔧 Initializing System Authority (Super Admin)...\n');

        // Hash the password
        const hashedPassword = await bcrypt.hash('Admin@12345678', 10);

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: { email: 'admin@csdept.com' }
        });

        if (existingUser) {
            // Update existing user - Ensure no branch dependency for Super Admin
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    password: hashedPassword,
                    branchId: null, // Super Admin is a global entity
                    role: 'SUPER_ADMIN',
                    displayName: 'System Administrator'
                }
            });
            console.log('✅ System Administrator updated successfully!');
        } else {
            // Create new user
            await prisma.user.create({
                data: {
                    email: 'admin@csdept.com',
                    displayName: 'System Administrator',
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    branchId: null, // Global scope
                    canDoMaintenance: true
                }
            });
            console.log('✅ System Administrator created successfully!');
        }

        console.log('\n📋 Core Admin Credentials:');
        console.log('   Email:    admin@csdept.com');
        console.log('   Password: Admin@12345678');
        console.log('   Role:     SUPER_ADMIN');
        console.log('   Scope:    Global (No Branch Dependency)\n');

    } catch (error) {

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
