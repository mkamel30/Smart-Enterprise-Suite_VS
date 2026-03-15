const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.customer.groupBy({
    by: ['bkcode'],
    having: {
      id: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${duplicates.length} duplicate bkcode groups.`);

  for (const dup of duplicates) {
    if (!dup.bkcode) {
      console.log('Skipping null/empty bkcode duplicate group (if any).');
      continue;
    }
    
    const customers = await prisma.customer.findMany({
      where: { bkcode: dup.bkcode },
      orderBy: { id: 'asc' },
    });

    console.log(`Fixing bkcode: ${dup.bkcode} (${customers.length} records)`);

    // Skip the first one, update the rest
    for (let i = 1; i < customers.length; i++) {
      const customer = customers[i];
      const newBkcode = `${dup.bkcode}-dup-${i}-${Math.random().toString(36).substring(7)}`;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { bkcode: newBkcode },
      });
      console.log(`  Updated Customer ID ${customer.id} to bkcode ${newBkcode}`);
    }
  }
  
  // also check for multiple null bkcodes since we can't have multiple nulls if it's uniquely constrained in postgres, though bkcode is String not String?.
  // wait, bkcode is String in schema.
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
