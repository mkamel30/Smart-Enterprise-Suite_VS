/**
 * Test Transfer Order Validations
 * ط§ط®طھط¨ط§ط± ط´ط§ظ…ظ„ ظ„ظ„ظ€ validations ط§ظ„ط¬ط¯ظٹط¯ط©
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 5000;
let authToken = '';

// Helper function to make HTTP requests
function apiRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: `/api${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? `Bearer ${authToken}` : ''
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: parsed, status: res.statusCode });
                    } else {
                        resolve({ success: false, error: parsed.error || parsed.message || body, status: res.statusCode });
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: body, status: res.statusCode });
                    } else {
                        resolve({ success: false, error: body, status: res.statusCode });
                    }
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('\nًں§ھ TESTING TRANSFER ORDER VALIDATIONS\n');
    console.log('='.repeat(80));

    // Step 1: Login
    console.log('\n1ï¸ڈâƒ£ Logging in as admin...');
    try {
        const loginRes = await apiRequest('POST', '/auth/login', {
            email: 'admin@csdept.com',
            password: 'admin123'
        });
        
        if (!loginRes.success) {
            console.error('â‌Œ Login failed:', loginRes.error);
            return;
        }
        
        authToken = loginRes.data.token;
        console.log('âœ… Login successful');
    } catch (error) {
        console.error('â‌Œ Login failed:', error.message);
        return;
    }

    // Step 2: Get branches
    console.log('\n2ï¸ڈâƒ£ Getting branches...');
    const branchesRes = await apiRequest('GET', '/branches');
    if (!branchesRes.success) {
        console.error('â‌Œ Failed to get branches');
        return;
    }

    const adminAffairs = branchesRes.data.find(b => b.type === 'ADMIN_AFFAIRS');
    const maintenanceCenter = branchesRes.data.find(b => b.type === 'MAINTENANCE_CENTER');
    const regularBranch = branchesRes.data.find(b => b.type === 'BRANCH');

    if (!adminAffairs || !maintenanceCenter || !regularBranch) {
        console.error('â‌Œ Missing required branches');
        return;
    }

    adminBranchId = adminAffairs.id;
    centerBranchId = maintenanceCenter.id;
    branch2Id = regularBranch.id;

    console.log(`âœ… Admin Affairs: ${adminAffairs.name} (${adminAffairs.id})`);
    console.log(`âœ… Maintenance Center: ${maintenanceCenter.name} (${maintenanceCenter.id})`);
    console.log(`âœ… Regular Branch: ${regularBranch.name} (${regularBranch.id})`);

    // Step 3: Get available machines from Admin Affairs
    console.log('\n3ï¸ڈâƒ£ Getting machines from Admin Affairs...');
    const inventoryRes = await apiRequest('GET', `/inventory?branchId=${adminBranchId}&type=MACHINE`);
    if (!inventoryRes.success || !inventoryRes.data.length) {
        console.error('â‌Œ No machines available in Admin Affairs');
        console.log('ًں’، Creating test machines...');
        
        // Create test machines
        const testMachines = [
            { serialNumber: 'TEST-MACHINE-001', model: 'D200', manufacturer: 'PAX', status: 'NEW' },
            { serialNumber: 'TEST-MACHINE-002', model: 'D210', manufacturer: 'PAX', status: 'NEW' },
            { serialNumber: 'TEST-MACHINE-003', model: 'S920', manufacturer: 'PAX', status: 'NEW' }
        ];

        for (const machine of testMachines) {
            await apiRequest('POST', '/inventory/warehouse/machines', {
                ...machine,
                branchId: adminBranchId
            });
        }
        console.log('âœ… Test machines created');
    }

    const availableMachines = inventoryRes.data.slice(0, 3);
    console.log(`âœ… Found ${availableMachines.length} available machines`);

    // ========== VALIDATION TESTS ==========
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION TESTS');
    console.log('='.repeat(80));

    // Test 1: Valid transfer
    console.log('\nâœ… TEST 1: Valid Transfer (Admin Affairs â†’ Regular Branch)');
    const validTransfer = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: adminBranchId,
        toBranchId: branch2Id,
        type: 'MACHINE',
        items: [{ serialNumber: availableMachines[0].serialNumber }],
        notes: 'Test valid transfer'
    });
    
    if (validTransfer.success) {
        console.log(`   âœ… PASS - Transfer created: ${validTransfer.data.orderNumber}`);
        
        // Test 2: Try to transfer same machine again (should FAIL - IN_TRANSIT)
        console.log('\nâ‌Œ TEST 2: Duplicate Transfer (Same machine - should FAIL)');
        const duplicateTransfer = await apiRequest('POST', '/transfer-orders', {
            fromBranchId: adminBranchId,
            toBranchId: centerBranchId,
            type: 'MACHINE',
            items: [{ serialNumber: availableMachines[0].serialNumber }],
            notes: 'Trying to transfer again'
        });
        
        if (!duplicateTransfer.success) {
            console.log(`   âœ… PASS - Transfer blocked: ${duplicateTransfer.error}`);
        } else {
            console.log(`   â‌Œ FAIL - Transfer should have been blocked!`);
        }
    } else {
        console.log(`   â‌Œ FAIL - Valid transfer failed: ${validTransfer.error}`);
    }

    // Test 3: Transfer to same branch (should FAIL)
    console.log('\nâ‌Œ TEST 3: Transfer to Same Branch (should FAIL)');
    const sameBranch = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: adminBranchId,
        toBranchId: adminBranchId,
        type: 'MACHINE',
        items: [{ serialNumber: availableMachines[1].serialNumber }],
        notes: 'Same branch test'
    });
    
    if (!sameBranch.success) {
        console.log(`   âœ… PASS - Transfer blocked: ${sameBranch.error}`);
    } else {
        console.log(`   â‌Œ FAIL - Should not allow transfer to same branch!`);
    }

    // Test 4: Transfer non-existent machine (should FAIL)
    console.log('\nâ‌Œ TEST 4: Transfer Non-Existent Machine (should FAIL)');
    const nonExistent = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: adminBranchId,
        toBranchId: branch2Id,
        type: 'MACHINE',
        items: [{ serialNumber: 'FAKE-SERIAL-999999' }],
        notes: 'Non-existent machine'
    });
    
    if (!nonExistent.success) {
        console.log(`   âœ… PASS - Transfer blocked: ${nonExistent.error}`);
    } else {
        console.log(`   â‌Œ FAIL - Should not allow non-existent machine!`);
    }

    // Test 5: Transfer machine from wrong branch (should FAIL)
    console.log('\nâ‌Œ TEST 5: Transfer from Wrong Branch (should FAIL)');
    const wrongBranch = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: branch2Id, // Machine is in Admin Affairs, not Branch 2
        toBranchId: centerBranchId,
        type: 'MACHINE',
        items: [{ serialNumber: availableMachines[1].serialNumber }],
        notes: 'Wrong branch test'
    });
    
    if (!wrongBranch.success) {
        console.log(`   âœ… PASS - Transfer blocked: ${wrongBranch.error}`);
    } else {
        console.log(`   â‌Œ FAIL - Should not allow transfer from wrong branch!`);
    }

    // Test 6: Empty items (should FAIL)
    console.log('\nâ‌Œ TEST 6: Empty Items List (should FAIL)');
    const emptyItems = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: adminBranchId,
        toBranchId: branch2Id,
        type: 'MACHINE',
        items: [],
        notes: 'Empty items'
    });
    
    if (!emptyItems.success) {
        console.log(`   âœ… PASS - Transfer blocked: ${emptyItems.error}`);
    } else {
        console.log(`   â‌Œ FAIL - Should not allow empty items!`);
    }

    // Test 7: Valid transfer to maintenance center
    console.log('\nâœ… TEST 7: Valid Transfer to Maintenance Center');
    const toCenter = await apiRequest('POST', '/transfer-orders', {
        fromBranchId: adminBranchId,
        toBranchId: centerBranchId,
        type: 'MAINTENANCE',
        items: [{ serialNumber: availableMachines[2].serialNumber }],
        notes: 'Send to maintenance'
    });
    
    if (toCenter.success) {
        console.log(`   âœ… PASS - Maintenance transfer created: ${toCenter.data.orderNumber}`);
    } else {
        console.log(`   â‌Œ FAIL - Maintenance transfer failed: ${toCenter.error}`);
    }

    // Test 8: Check pending serials
    console.log('\nâœ… TEST 8: Check Pending Serials Endpoint');
    const pendingRes = await apiRequest('GET', '/transfer-orders/pending-serials');
    if (pendingRes.success) {
        console.log(`   âœ… PASS - Found ${pendingRes.data.length} pending serials`);
        console.log(`   Pending: ${pendingRes.data.join(', ')}`);
    } else {
        console.log(`   â‌Œ FAIL - Could not get pending serials`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('âœ… VALIDATION TESTS COMPLETE');
    console.log('='.repeat(80));
    console.log('\nًں’، Key Points:');
    console.log('   â€¢ Machines are FROZEN (IN_TRANSIT) during transfer');
    console.log('   â€¢ Cannot transfer same machine twice');
    console.log('   â€¢ Cannot transfer from wrong branch');
    console.log('   â€¢ Cannot transfer to same branch');
    console.log('   â€¢ Comprehensive validations applied');
    console.log('\n');
}

// Run tests
runTests().catch(console.error);
