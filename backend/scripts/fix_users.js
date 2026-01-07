const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function fixUsers() {
    try {
        // 1. Revert Technician (Amr Kamal)
        // I'll search by the ID I saw earlier or by name if ID fails, but likely the ID is stable.
        // ID seen: cmj70c0bm0000111gfzcg0pu
        // However, I'll search by the email I wrongly assigned to be safe.
        const technician = await prisma.user.findFirst({
            where: { email: 'admin@system.com', displayName: 'ط¹ظ…ط±ظˆ ظƒظ…ط§ظ„' }
        });

        if (technician) {
            console.log(`Reverting technician: ${technician.displayName}`);
            await prisma.user.update({
                where: { id: technician.id },
                data: {
                    email: null,
                    password: null,
                    role: 'Technician'
                }
            });
            console.log('Technician reverted successfully.');
        } else {
            console.log('Technician with admin email not found (maybe already fixed?).');
        }

        // 2. Create Fresh Admin User
        // Check if admin exists (after the revert, it shouldn't, or if I messed up earlier)
        const existingAdmin = await prisma.user.findFirst({
            where: { email: 'admin@system.com' }
        });

        if (!existingAdmin) {
            console.log('Creating new Admin user...');
            const hashedPassword = await bcrypt.hash('admin1234', 10);
            await prisma.user.create({
                data: {
                    email: 'admin@system.com',
                    password: hashedPassword,
                    displayName: 'System Admin',
                    role: 'SUPER_ADMIN'
                }
            });
            console.log('New Admin user created successfully.');
        } else {
            console.log('Admin user already exists (unexpected if we just reverted, unless names differed).');
        }

    } catch (error) {
        console.error('Error fixing users:', error);
    }
}

fixUsers().finally(() => prisma.$disconnect());
