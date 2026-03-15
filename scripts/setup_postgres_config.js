const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const prismaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

console.log('🔄 Switching configuration to PostgreSQL...');

// 1. Update all .env files
const envFiles = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', 'backend', '.env')
];

envFiles.forEach(envPath => {
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Comment out SQLite if active (handles both quoted and unquoted)
        if (!envContent.match(/#\s*DATABASE_URL="?file:/)) {
            envContent = envContent.replace(
                /(DATABASE_URL="?file:.*?dev\.db"?)/g,
                '# $1'
            );
        }

        // Add Postgres if missing (Using 127.0.0.1:5433 for Windows reliability)
        if (!envContent.includes('postgresql://')) {
            envContent += '\n# PostgreSQL Connection\nDATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/smart_enterprise?schema=public"\n';
        } else {
            // Uncomment if existing, and force 127.0.0.1:5433
            envContent = envContent.replace(
                /#\s*(DATABASE_URL="postgresql:)/g,
                '$1'
            ).replace(
                /@localhost:/g,
                '@127.0.0.1:'
            ).replace(
                /:5432\//g,
                ':5433/'
            );
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`✅ Updated ${path.relative(path.join(__dirname, '..'), envPath)}`);
    }
});

// 2. Update all schema.prisma files
const prismaPaths = [
    path.join(__dirname, '..', 'prisma', 'schema.prisma'),
    path.join(__dirname, '..', 'backend', 'prisma', 'schema.prisma')
];

prismaPaths.forEach(schemaPath => {
    if (fs.existsSync(schemaPath)) {
        let schemaContent = fs.readFileSync(schemaPath, 'utf8');

        // Change provider to postgresql
        schemaContent = schemaContent.replace(
            /provider\s*=\s*"sqlite"/g,
            'provider = "postgresql"'
        );

        // Replace url with env variable
        schemaContent = schemaContent.replace(
            /url\s*=\s*".*?"/g,
            'url      = env("DATABASE_URL")'
        );

        fs.writeFileSync(schemaPath, schemaContent);
        console.log(`✅ Updated schema at: ${path.relative(path.join(__dirname, '..'), schemaPath)}`);
    }
});

console.log('🚀 Configuration ready for migration!');
