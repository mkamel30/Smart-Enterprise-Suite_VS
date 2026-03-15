const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../../prisma/schema.prisma');
const TARGET_DIRS = [
    path.join(__dirname, '../../routes'),
    path.join(__dirname, '../../services')
];
const OUTPUT_FILE = path.join(process.cwd(), 'audit_report.json');

function toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Extracts content within the first balanced set of braces {}
 * starting from a given search string.
 */
function extractBalancedBlock(content, searchKey) {
    const startIndex = content.indexOf(searchKey);
    if (startIndex === -1) return null;

    const braceStart = content.indexOf('{', startIndex);
    if (braceStart === -1) return null;

    let depth = 0;
    for (let i = braceStart; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
            depth--;
            if (depth === 0) {
                return content.substring(braceStart + 1, i);
            }
        }
    }
    return null;
}

function parseSchema() {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const models = {};
    let currentModel = null;
    schemaContent.split('\n').forEach(line => {
        const lineTrim = line.trim();
        const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
        if (modelMatch) {
            currentModel = modelMatch[1];
            models[currentModel] = new Set();
        } else if (lineTrim === '}') {
            currentModel = null;
        } else if (currentModel) {
            const fieldMatch = lineTrim.match(/^(\w+)\s+/);
            if (fieldMatch) models[currentModel].add(fieldMatch[1]);
        }
    });
    return models;
}

/**
 * Extremely basic object literal parser that tries to find top-level keys
 * Improved to ignore strings and multi-line comments
 */
function parseObjectLiteral(str) {
    // 1. Strip comments
    let clean = str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

    // 2. Strip string literals (simple version)
    clean = clean.replace(/(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, '""');

    const obj = {};
    // Regex to find "key:" but try to ignore nested ones by checking depth? 
    // For now, let's just find "key:" that isn't preceded by something that indicates nesting?
    // Actually, a simple recursive descent or brace counting would be better.

    let depth = 0;
    let currentKey = "";
    let inKey = false;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === '{') {
            depth++;
            continue;
        }
        if (char === '}') {
            depth--;
            continue;
        }

        // We only care about keys at the top level of this string (which is already inside the data: block)
        if (depth === 0) {
            // Very simple state machine to find word:
            if (/\w/.test(char)) {
                currentKey += char;
                inKey = true;
            } else if (char === ':') {
                if (inKey) {
                    obj[currentKey.trim()] = true;
                    currentKey = "";
                    inKey = false;
                }
            } else if (/\s/.test(char)) {
                // Ignore whitespace
            } else {
                currentKey = "";
                inKey = false;
            }
        }
    }
    return obj;
}

const modelsSchema = parseSchema();
const results = { scannedFiles: 0, totalViolations: 0, totalPrismaCalls: 0, violations: [] };

function auditFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.relative(process.cwd(), filePath);

    Object.keys(modelsSchema).forEach(modelName => {
        const validFields = modelsSchema[modelName];
        const camelModelName = toCamelCase(modelName);

        const modelMethodRegex = new RegExp(`\\.(?:${modelName}|${camelModelName})\\.(create|update|upsert|findFirst|findMany|findUnique|delete|deleteMany|count|aggregate|groupBy)\\s*\\(\\s*\\{([\\s\\S]+?)\\}\\s*(?:,\\s*\\{[^}]*\\}\\s*)?\\)`, 'g');

        const matches = content.matchAll(modelMethodRegex);
        for (const match of matches) {
            results.totalPrismaCalls++;
            const method = match[1];
            const body = match[2];

            const keysMatch = body.matchAll(/['"]?(\w+)['"]?\s*:/g);
            for (const keyMatch of keysMatch) {
                const key = keyMatch[1];
                const ignoredKeys = [
                    'data', 'where', 'select', 'include', 'orderBy', 'take', 'skip',
                    'distinct', 'connect', 'disconnect', '_count', '_sum', '_avg',
                    '_min', '_max', 'cursor', 'set', 'increment', 'decrement', 'multiply', 'divide',
                    'every', 'some', 'none', 'is', 'isNot', 'lte', 'gte', 'lt', 'gt', 'contains', 'startsWith', 'endsWith', 'in', 'notIn', 'not', 'mode', 'equals',
                    'OR', 'AND', 'NOT', 'includeEmpty', 'by', 'create', 'update', '_skipBranchEnforcer'
                ];

                if (!ignoredKeys.includes(key) && !validFields.has(key)) {
                    // Naive check for nested objects like 'connect'
                    const keyIndex = body.indexOf(key + ':');
                    const textBeforeKey = body.substring(0, keyIndex);
                    const lastOpenBrace = textBeforeKey.lastIndexOf('{');
                    const textAfterLastBrace = textBeforeKey.substring(lastOpenBrace);
                    if (textAfterLastBrace.includes('connect:') || textAfterLastBrace.includes('disconnect:')) continue;

                    results.totalViolations++;
                    results.violations.push({ file: fileName, model: modelName, method: method, badField: key });
                }
            }
        }
    });
}

TARGET_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    function walk(d) {
        fs.readdirSync(d).forEach(item => {
            const p = path.join(d, item);
            const stat = fs.statSync(p);
            if (stat.isDirectory()) walk(p);
            else if (p.endsWith('.js')) { results.scannedFiles++; auditFile(p); }
        });
    }
    walk(dir);
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
console.log(`Audit complete. Results saved to ${OUTPUT_FILE}`);
