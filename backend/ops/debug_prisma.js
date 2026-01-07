// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const db = require('./db');

async function debug() {
    console.log('DB Keys:', Object.keys(db));
    if (db.stockMovement) {
        console.log('db.stockMovement exists');
    } else {
        console.log('db.stockMovement MISSING');
    }

    // Check capitalization variants
    console.log('StockMovement?', !!db.StockMovement);
    console.log('stockmovement?', !!db.stockmovement);

    try {
        await db.$transaction(async (tx) => {
            console.log('TX Keys:', Object.keys(tx));
            console.log('tx.stockMovement?', !!tx.stockMovement);
        });
    } catch (e) {
        console.log('TX Error:', e);
    }
}

debug()
    .catch(console.error)
    .finally(() => db.$disconnect());
