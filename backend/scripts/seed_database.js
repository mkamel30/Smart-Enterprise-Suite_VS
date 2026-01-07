const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...\n');

        // 1. Create Admin Affairs Branch (required for many operations)
        console.log('1️⃣  Creating Admin Affairs branch...');
        const adminAffairs = await prisma.branch.upsert({
            where: { code: 'AA001' },
            update: {},
            create: {
                code: 'AA001',
                name: 'شؤون الإدارة',
                type: 'ADMIN_AFFAIRS',
                isActive: true,
                address: 'Main Office'
            }
        });
        console.log('   ✅ Admin Affairs created:', adminAffairs.name);

        // 2. Create a Maintenance Center
        console.log('\n2️⃣  Creating Maintenance Center...');
        const maintenanceCenter = await prisma.branch.upsert({
            where: { code: 'MC001' },
            update: {},
            create: {
                code: 'MC001',
                name: 'مركز الصيانة الرئيسي',
                type: 'MAINTENANCE_CENTER',
                isActive: true,
                address: 'Service Center Location'
            }
        });
        console.log('   ✅ Maintenance Center created:', maintenanceCenter.name);

        // 3. Create Sample Branches
        console.log('\n3️⃣  Creating sample branches...');
        const branch1 = await prisma.branch.upsert({
            where: { code: 'BR001' },
            update: {},
            create: {
                code: 'BR001',
                name: 'فرع القاهرة',
                type: 'BRANCH',
                isActive: true,
                address: 'Cairo Branch',
                maintenanceCenterId: maintenanceCenter.id
            }
        });
        
        const branch2 = await prisma.branch.upsert({
            where: { code: 'BR002' },
            update: {},
            create: {
                code: 'BR002',
                name: 'فرع الإسكندرية',
                type: 'BRANCH',
                isActive: true,
                address: 'Alexandria Branch',
                maintenanceCenterId: maintenanceCenter.id
            }
        });
        console.log('   ✅ Branches created: BR001, BR002');

        // 4. Create Client Types
        console.log('\n4️⃣  Creating client types...');
        const clientTypes = ['VIP', 'Regular', 'Corporate', 'Government'];
        for (const type of clientTypes) {
            await prisma.clientType.upsert({
                where: { name: type },
                update: {},
                create: {
                    name: type,
                    description: `${type} customer type`
                }
            });
        }
        console.log('   ✅ Client types created:', clientTypes.join(', '));

        // 5. Create Sample Customers
        console.log('\n5️⃣  Creating sample customers...');
        const customer1 = await prisma.customer.upsert({
            where: { bkcode: 'CUST001' },
            update: {},
            create: {
                bkcode: 'CUST001',
                client_name: 'محمد أحمد',
                branchId: branch1.id,
                clienttype: 'Regular',
                telephone_1: '01012345678',
                address: 'Cairo, Egypt',
                isSpecial: false
            }
        });

        const customer2 = await prisma.customer.upsert({
            where: { bkcode: 'CUST002' },
            update: {},
            create: {
                bkcode: 'CUST002',
                client_name: 'فاطمة حسن',
                branchId: branch2.id,
                clienttype: 'VIP',
                telephone_1: '01098765432',
                address: 'Alexandria, Egypt',
                isSpecial: true
            }
        });
        console.log('   ✅ Sample customers created');

        // 6. Create Sample Spare Parts
        console.log('\n6️⃣  Creating spare parts...');
        const spareParts = [
            { name: 'شاشة LCD', partNumber: 'SP001', price: 500, description: 'LCD Display Screen' },
            { name: 'لوحة مفاتيح', partNumber: 'SP002', price: 150, description: 'Keyboard' },
            { name: 'طابعة حرارية', partNumber: 'SP003', price: 800, description: 'Thermal Printer' },
            { name: 'قارئ بطاقات', partNumber: 'SP004', price: 300, description: 'Card Reader' }
        ];

        for (const part of spareParts) {
            const existing = await prisma.sparePart.findFirst({
                where: { partNumber: part.partNumber }
            });
            
            if (!existing) {
                await prisma.sparePart.create({
                    data: {
                        name: part.name,
                        partNumber: part.partNumber,
                        defaultCost: part.price,
                        description: part.description,
                        isConsumable: false,
                        allowsMultiple: true
                    }
                });
            }
        }
        console.log('   ✅ Spare parts created');

        // 7. Create Inventory Items for branches
        console.log('\n7️⃣  Creating inventory items...');
        const parts = await prisma.sparePart.findMany();
        for (const part of parts) {
            await prisma.inventoryItem.create({
                data: {
                    partId: part.id,
                    branchId: branch1.id,
                    quantity: 10,
                    minLevel: 5
                }
            });
        }
        console.log('   ✅ Inventory items created for BR001');

        // 8. Update admin user with branch
        console.log('\n8️⃣  Updating admin user...');
        const adminUser = await prisma.user.findFirst({
            where: { email: 'admin@csdept.com' }
        });

        if (adminUser) {
            await prisma.user.update({
                where: { id: adminUser.id },
                data: { branchId: adminAffairs.id }
            });
            console.log('   ✅ Admin user linked to Admin Affairs branch');
        }

        // 9. Create additional users
        console.log('\n9️⃣  Creating additional users...');
        const hashedPassword = await bcrypt.hash('user123', 10);
        
        const existingManager = await prisma.user.findFirst({ where: { email: 'manager@csdept.com' } });
        if (!existingManager) {
            await prisma.user.create({
                data: {
                    email: 'manager@csdept.com',
                    displayName: 'Branch Manager',
                    password: hashedPassword,
                    role: 'CS_SUPERVISOR',
                    branchId: branch1.id,
                    canDoMaintenance: false
                }
            });
        }

        const existingTech = await prisma.user.findFirst({ where: { email: 'tech@csdept.com' } });
        if (!existingTech) {
            await prisma.user.create({
                data: {
                    email: 'tech@csdept.com',
                    displayName: 'Maintenance Technician',
                    password: hashedPassword,
                    role: 'CENTER_TECH',
                    branchId: maintenanceCenter.id,
                    canDoMaintenance: true
                }
            });
        }
        console.log('   ✅ Additional users created');

        console.log('\n✅ Database seeding completed successfully!\n');
        console.log('═══════════════════════════════════════');
        console.log('📊 Summary:');
        console.log('───────────────────────────────────────');
        console.log('Branches:        3 (1 Admin Affairs, 1 Center, 2 Branches)');
        console.log('Users:           3 (admin, manager, tech)');
        console.log('Customers:       2');
        console.log('Spare Parts:     4');
        console.log('Client Types:    4');
        console.log('Inventory Items: 4');
        console.log('═══════════════════════════════════════\n');

        console.log('🔐 User Credentials:');
        console.log('Admin:    admin@csdept.com / admin123');
        console.log('Manager:  manager@csdept.com / user123');
        console.log('Tech:     tech@csdept.com / user123');
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}

seedDatabase()
    .finally(() => prisma.$disconnect());
