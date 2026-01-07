const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function createAdminUser() {
    try {
        // Check if admin already exists
        const existingAdmin = await prisma.user.findFirst({
            where: {
                email: 'admin@csdept.com'
            }
        });

        if (existingAdmin) {
            console.log('âœ“ Admin user already exists!');
            console.log('\nLogin Credentials:');
            console.log('==================');
            console.log('Email:    admin@csdept.com');
            console.log('Password: admin123');
            console.log('==================\n');
            return;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Create the admin user
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin@csdept.com',
                displayName: 'System Administrator',
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                canDoMaintenance: true,
                theme: 'light',
                fontFamily: 'IBM Plex Sans Arabic'
            }
        });

        console.log('âœ“ Admin user created successfully!');
        console.log('\nLogin Credentials:');
        console.log('==================');
        console.log('Email:    admin@csdept.com');
        console.log('Password: admin123');
        console.log('Role:     SUPER_ADMIN');
        console.log('==================\n');
        console.log('User ID:', adminUser.id);

    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

createAdminUser()
    .finally(() => prisma.$disconnect());
