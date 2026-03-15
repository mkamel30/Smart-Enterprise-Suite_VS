/**
 * Enhanced Modal Audit Script
 * Finds all modals in the project using broader patterns
 */

const fs = require('fs');
const path = require('path');

const modals = [];
const oldModalPatterns = [
    /fixed.*?inset-0.*?flex.*?items-center/, // Full screen overlay
    /bg-black\/50.*?flex.*?items-center/,  // Common overlay colors
    /bg-slate-900\/60.*?flex.*?items-center/ // More common colors
];

const newModalPatterns = [
    /className="modal-overlay"/,
    /className="modal-container/,
    /className="modal-header"/
];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check for "fixed" combined with "inset-0" and "z-"
    const hasFixedOverlay = (content.includes('fixed') && content.includes('inset-0') && content.includes('flex'));
    const hasNewModal = newModalPatterns.some(pattern => pattern.test(content));
    const hasOldModal = oldModalPatterns.some(pattern => pattern.test(content)) || (hasFixedOverlay && !hasNewModal);

    if (hasOldModal || hasNewModal) {
        // Count potential modals by looking for closing divs and overlays
        const modalCount = (content.match(/fixed.*?inset-0/g) || []).length || (content.match(/modal-overlay/g) || []).length;

        if (modalCount > 0) {
            modals.push({
                file: relativePath,
                count: modalCount,
                usesNewSystem: hasNewModal,
                usesOldSystem: hasOldModal,
                mixed: hasNewModal && hasOldModal
            });
        }
    }
}

function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
            scanFile(fullPath);
        }
    }
}

console.log('🔍 Enhanced scan for modals in the project...\n');
scanDirectory(path.join(__dirname, 'frontend', 'src'));

console.log('='.repeat(80));
const totalModals = modals.reduce((sum, m) => sum + m.count, 0);
console.log(`\n📊 Found ${modals.length} files with approx ${totalModals} modals:\n`);

const oldSystem = modals.filter(m => m.usesOldSystem && !m.usesNewSystem);
const newSystem = modals.filter(m => m.usesNewSystem && !m.mixed);
const mixed = modals.filter(m => m.mixed);

console.log(`✅ Using NEW modal system: ${newSystem.length} files`);
console.log(`⚠️  Using OLD modal system: ${oldSystem.length} files`);
if (mixed.length > 0) console.log(`🔄 Mixed (both old and new): ${mixed.length} files`);

const report = {
    summary: {
        totalFiles: modals.length,
        totalModals,
        newSystem: newSystem.length,
        oldSystem: oldSystem.length,
        mixed: mixed.length,
        migrationProgress: Math.round((newSystem.length / modals.length) * 100)
    },
    oldSystemFiles: oldSystem.sort((a, b) => b.count - a.count),
    newSystemFiles: newSystem,
    mixedFiles: mixed
};

fs.writeFileSync(
    path.join(__dirname, 'modal_audit_report.json'),
    JSON.stringify(report, null, 2)
);

console.log(`\n📄 Detailed report saved to: modal_audit_report.json\n`);
