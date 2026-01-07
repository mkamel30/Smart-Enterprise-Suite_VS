// Utility function to check if machine exists in both locations
async function checkMachineDuplication(serialNumber, db) {
    const inWarehouse = await db.warehouseMachine.findUnique({
        where: { serialNumber }
    });

    const withCustomer = await db.posMachine.findUnique({
        where: { serialNumber }
    });

    return {
        inWarehouse: !!inWarehouse,
        withCustomer: !!withCustomer,
        isDuplicated: !!(inWarehouse && withCustomer)
    };
}

// Detect machine model and manufacturer from serial number prefix
// This is a sync function that uses cached parameters (passed in) or returns empty
function detectMachineParams(serialNumber, machineParams = []) {
    if (!serialNumber || serialNumber.length < 3) {
        return { model: null, manufacturer: null };
    }

    const sn = serialNumber.toUpperCase();

    // Try to match prefix from longest to shortest (5 chars down to 2)
    for (let len = Math.min(5, sn.length); len >= 2; len--) {
        const prefix = sn.substring(0, len);
        const match = machineParams.find(p => p.prefix === prefix);
        if (match) {
            return {
                model: match.model,
                manufacturer: match.manufacturer
            };
        }
    }

    return { model: null, manufacturer: null };
}

module.exports = { checkMachineDuplication, detectMachineParams };
