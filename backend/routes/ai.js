const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// Guarded raw SQL: use safe wrappers from backend/prisma/safeRaw.js
const { queryRawUnsafeSafe, executeRawUnsafeSafe } = require('../prisma/safeRaw');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// The user already provided the key earlier, we will assume it is in the .env file now.
// OPENROUTER_API_KEY=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
const client = new OpenAI({
    apiKey: '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',
    baseURL: "https://openrouter.ai/api/v1",
});

// List of models to try in order
// List of models to try in order
const MODELS = [
    "moonshot/moonshot-v1-8k",           // Kimi K2
    "z-ai/glm-4.5-air:free",             // Z.AI: GLM 4.5 Air (free)
    "kwaipilot/kat-coder-pro:free",      // Kwaipilot: KAT-Coder-Pro V1 (free)
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-flash-1.5",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-70b-instruct:free",
    "microsoft/wizardlm-2-8x22b",
    "zhipu/glm-4-plus",
];

// Get available models
router.get('/ai/models', (req, res) => {
    res.json(MODELS);
});

router.post('/ai/query', authenticateToken, async (req, res) => {
    try {
        const { prompt, model } = req.body;
        const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'];
        const isCentral = req.user && centralRoles.includes(req.user.role);
        const userBranchId = req.user.branchId;

        // 1. Define DB Schema for AI Context
        const dbSchema = `
        Table: MaintenanceRequest
        Columns: id, customerId, customerName, posMachineId, machineModel, serialNumber, status (Open, In Progress, Closed), technician, complaint, actionTaken, createdAt, closingTimestamp, totalCost, receiptNumber. branchId,
        
        Table: Customer
        Columns: bkcode (ID), client_name, address, telephone_1, telephone_2, operating_date, isSpecial. branchId,

        Table: InventoryItem
        Columns: id, partId, quantity, minLevel, location. branchId,
        relation: part -> SparePart

        Table: SparePart
        Columns: id, partNumber, name, defaultCost. branchId,

        Table: StockMovement
        Columns: id, partId, branchId, type (IN/OUT), quantity, reason, createdAt.
        relation: part -> SparePart

        Table: Payment
        Columns: amount, type, branchId, reason, receiptNumber, createdAt, paymentPlace.
        `;

        // 2. Step 1: Ask AI to generate SQL
        const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql');
        const sqlSystemPrompt = `
        You are an expert SQL Data Analyst for a ${isPostgres ? 'PostgreSQL' : 'SQLite'} database.
        Your goal is to generate a READ-ONLY SQL query to answer the user's question based on the provided schema.
        
        Current User Context: ${isCentral ? 'Central Operations (Full Access)' : `Branch Staff (Locked to Branch ID: ${userBranchId})`}
        
        Rules:
        1. Output ONLY the raw SQL query. No markdown, no explanations, no code blocks.
        2. Use ${isPostgres ? 'PostgreSQL' : 'SQLite'} syntax.
        3. ONLY use SELECT statements. NEVER use INSERT, UPDATE, DELETE, DROP.
        4. Use SINGLE QUOTES inside SQL for string values (e.g., name = 'Item'). DO NOT use double quotes for strings.
        5. Do NOT quote column names or table names unless absolutely necessary (e.g. if they contain spaces).
        6. Do NOT assume 'createdAt' exists on all tables. formatting dates: ${isPostgres ? "TO_CHAR(date_column, 'YYYY-MM-DD')" : "strftime('%Y-%m-%d', date_column)"}.
           - For MaintenanceRequest, Payment, StockMovement: use 'createdAt'.
           - For WarehouseMachine: use 'importDate' or 'updatedAt'.
           - For Customer: use 'operating_date'.
           - SparePart and InventoryItem DO NOT have date columns.
        7. If the user is NOT a Central User (isCentral is false), ALWAYS include a filter: branchId = '${userBranchId}' in the WHERE clause for all queried tables (except SparePart).
        8. If the user asks for "recent" items, use the appropriate date column for that table.
        9. If the user asks about "Spare parts today", query the 'StockMovement' table joined with 'SparePart'.
        10. Today's date is ${new Date().toISOString().slice(0, 10)}.
        11. LIMIT results to 20 rows unless specified otherwise.
        
        Schema:
        ${dbSchema}
        `;

        let sqlQuery = null;

        // Internal Router: Use requested model first if provided, then fallback
        // We prioritize the user's choice for SQL generation too, as they might know which model works best.
        let SQL_MODELS = ["google/gemini-2.0-flash-exp:free", ...MODELS];
        if (model) {
            SQL_MODELS = [model, ...MODELS.filter(m => m !== model)];
        }

        // Try to get SQL from AI
        for (const m of SQL_MODELS) {
            try {
                console.log(`ًں¤– Step 1: Generating SQL with ${m}...`);
                const completion = await client.chat.completions.create({
                    model: m,
                    messages: [
                        { role: "system", content: sqlSystemPrompt },
                        { role: "user", content: `Question: ${prompt}` }
                    ],
                });

                if (completion.choices && completion.choices[0]) {
                    let text = completion.choices[0].message.content.trim();
                    console.log(`ًں¤– Raw output from ${m}:`, text);

                    // 1. Clean markdown
                    text = text.replace(/```sql/gi, '').replace(/```/g, '').trim();

                    // 2. Try to find start of query
                    // We look for "select" case insensitive
                    const selectIndex = text.toLowerCase().indexOf('select');

                    if (selectIndex !== -1) {
                        // Take everything from SELECT onwards
                        sqlQuery = text.substring(selectIndex);

                        // Clean up any trailing semicolon or text
                        const semicolonIndex = sqlQuery.lastIndexOf(';');
                        if (semicolonIndex !== -1) {
                            sqlQuery = sqlQuery.substring(0, semicolonIndex + 1);
                        }

                        console.log(`âœ… Extracted SQL: ${sqlQuery}`);
                        break;
                    }
                }
            } catch (err) {
                console.warn(`âڑ ï¸ڈ Model ${m} failed to gen SQL: ${err.message}`);
                if (err.response) console.warn(err.response.data);
            }
        }

        if (!sqlQuery) {
            console.warn("âڑ ï¸ڈ No SQL generated. Switching to Fallback Mode (Lite Context).");

            // Fallback: Fetch basic data to answer general questions or simple queries
            try {
                const [recentRequests, recentPayments, inventorySummary] = await Promise.all([
                    db.maintenanceRequest.findMany(ensureBranchWhere({
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        select: { customerName: true, status: true, totalCost: true, createdAt: true, complaint: true }
                    }, req)),
                    db.payment.findMany(ensureBranchWhere({
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        select: { amount: true, reason: true, createdAt: true }
                    }, req)),
                    db.inventoryItem.findMany(ensureBranchWhere({
                        where: { quantity: { lt: 5 } }, // Low stock items
                        take: 20,
                        include: { part: { select: { name: true } } }
                    }, req))
                ]);

                const fallbackContext = `
                SQL Generation Failed. Using recent data snapshot instead.
                
                Recent Maintenance Requests:
                ${JSON.stringify(recentRequests)}
                
                Recent Payments:
                ${JSON.stringify(recentPayments)}
                
                Low Stock Items (<5):
                ${JSON.stringify(inventorySummary.map(i => ({ part: i.part.name, qty: i.quantity })))}
                
                User Question: ${prompt}
                `;

                // Ask AI to answer based on this snapshot
                // Use requested model first if provided
                const fallbackModels = model ? [model, ...MODELS.filter(m => m !== model)] : MODELS;

                for (const m of fallbackModels) {
                    try {
                        const completion = await client.chat.completions.create({
                            model: m,
                            messages: [
                                { role: "system", content: "You are a helpful assistant. Answer the user info based on the provided data snapshot. Speak Arabic." },
                                { role: "user", content: fallbackContext }
                            ]
                        });
                        if (completion.choices && completion.choices[0]) {
                            return res.json({ answer: "âڑ ï¸ڈ (ط¥ط¬ط§ط¨ط© طھظ‚ط±ظٹط¨ظٹط©): " + completion.choices[0].message.content });
                        }
                    } catch (e) { }
                }
            } catch (fbError) {
                console.error("Fallback error:", fbError);
            }

            return res.json({ answer: "ط¹ط°ط±ط§ظ‹طŒ ظ„ظ… ط£طھظ…ظƒظ† ظ…ظ† ظپظ‡ظ… ط·ظ„ط¨ظƒ ط£ظˆ ط§ظ„ظˆطµظˆظ„ ظ„ظ„ط¨ظٹط§ظ†ط§طھ." });
        }

        // 3. Step 2: Execute SQL (Safely)
        let queryResults = [];
        try {
            // Very basic safety check
            if (!sqlQuery.toLowerCase().includes('select')) {
                throw new Error('Only SELECT queries are allowed.');
            }
            queryResults = await queryRawUnsafeSafe(sqlQuery);
            // Convert BigInt to string for JSON serialization
            queryResults = JSON.parse(JSON.stringify(queryResults, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v
            ));

        } catch (dbError) {
            console.error('SQL Execution Error:', dbError);
            return res.json({ answer: `ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ط¨ط­ط« ظپظٹ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ: ${dbError.message}` });
        }

        // 4. Step 3: Summarize Answer
        const summarySystemPrompt = `
        You are a helpful assistant for a maintenance center. You speak Arabic (Egypt).
        You will receive a User Question and the Database Results.
        Your job is to answer the question clearly and concisely in Arabic based on the results.
        Format the answer nicely (lists, bold text).
        `;

        let finalAnswer = null;

        // Use requested model first if provided
        const summaryModels = model ? [model, ...MODELS.filter(m => m !== model)] : MODELS;

        for (const m of summaryModels) {
            try {
                const completion = await client.chat.completions.create({
                    model: m,
                    messages: [
                        { role: "system", content: summarySystemPrompt },
                        { role: "user", content: `Question: ${prompt}\n\nDatabase Results: ${JSON.stringify(queryResults).slice(0, 8000)}` } // Slice limit for context window
                    ],
                });

                if (completion.choices && completion.choices[0]) {
                    finalAnswer = completion.choices[0].message.content;
                    break;
                }
            } catch (err) {
                console.warn(`âڑ ï¸ڈ Model ${m} failed to summarize: ${err.message}`);
            }
        }

        res.json({ answer: finalAnswer || "ط¹ط°ط±ط§ظ‹طŒ ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طµظٹط§ط؛ط© ط§ظ„ط¥ط¬ط§ط¨ط©." });

    } catch (error) {
        console.error('AI Query Error Full:', error);
        res.status(500).json({
            error: error.message || 'Failed to process AI query',
            details: error.response ? error.response.data : null
        });
    }
});

module.exports = router;
