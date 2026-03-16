const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

async function obfuscateProject() {
    // Move build dir outside to avoid circular copy
    const buildDir = path.join(__dirname, '../build-backend');
    
    // 1. Clean and create build dir
    if (await fs.exists(buildDir)) {
        await fs.remove(buildDir);
    }
    await fs.ensureDir(buildDir);

    // 2. Copy everything from backend to build dir, excluding node_modules and other junk
    console.log('--- Copying files to build directory ---');
    await fs.copy(__dirname, buildDir, {
        filter: (src) => {
            const relative = path.relative(__dirname, src);
            return !relative.includes('node_modules') && 
                   !relative.includes('obfuscated_build') &&
                   !relative.includes('.git') &&
                   !relative.includes('logs') &&
                   !relative.includes('backups');
        }
    });

    // 3. Find all .js files in the build dir (excluding non-source files if needed)
    console.log('--- Obfuscating JavaScript files ---');
    const files = glob.sync(`${buildDir}/**/*.js`, {
        ignore: [
            `${buildDir}/package.json`,
            `${buildDir}/obfuscate.js` // Don't obfuscate this script itself
        ]
    });

    for (const file of files) {
        console.log(`Obfuscating: ${path.relative(buildDir, file)}`);
        const code = await fs.readFile(file, 'utf8');
        
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: true,
            debugProtectionInterval: 4000,
            disableConsoleOutput: true,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 10,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayCallsTransformThreshold: 0.75,
            stringArrayEncoding: ['base64'],
            stringArrayIndicesShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 2,
            stringArrayWrappersChainedCalls: true,
            stringArrayWrappersParametersMaxCount: 4,
            stringArrayWrappersType: 'function',
            stringArrayThreshold: 0.75,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
        });

        await fs.writeFile(file, obfuscationResult.getObfuscatedCode());
    }

    console.log('--- Obfuscation Complete! ---');
    console.log(`Build ready in: ${buildDir}`);
}

if (require.main === module) {
    obfuscateProject().catch(err => {
        console.error('Obfuscation failed:', err);
        process.exit(1);
    });
}
