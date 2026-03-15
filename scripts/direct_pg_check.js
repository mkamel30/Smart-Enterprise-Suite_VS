const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@127.0.0.1:5433/smart_enterprise"
    });

    try {
        await client.connect();
        const res = await client.query('SELECT count(*) FROM "User"');
        console.log('Postgres User Count:', res.rows[0].count);

        if (res.rows[0].count > 0) {
            const users = await client.query('SELECT username FROM "User" LIMIT 5');
            console.log('Users in Postgres:', users.rows.map(r => r.username));
        }
    } catch (err) {
        console.error('Postgres Check Error:', err.message);
    } finally {
        await client.end();
    }
}

check();
