-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'CS_AGENT',
    "canDoMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "theme" TEXT DEFAULT 'light',
    "fontFamily" TEXT DEFAULT 'IBM Plex Sans Arabic',
    "fontSize" TEXT DEFAULT 'small',
    "highlightEffect" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "mobilePush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    -- Password policy fields
    "passwordChangedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN DEFAULT false,
    "lastLoginAt" DATETIME,
    "loginCount" INT DEFAULT 0,
    -- MFA fields
    "mfaEnabled" BOOLEAN DEFAULT false,
    "mfaSecret" TEXT,
    "mfaRecoveryCodes" TEXT,
    "mfaSetupPending" BOOLEAN DEFAULT false,
    "mfaTempSecret" TEXT,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" (
    "id", "uid", "email", "displayName", "role", "canDoMaintenance", "password",
    "theme", "fontFamily", "fontSize", "highlightEffect", "notificationSound",
    "mobilePush", "createdAt", "branchId", "passwordChangedAt", "mustChangePassword",
    "lastLoginAt", "loginCount"
) SELECT 
    "id", "uid", "email", "displayName", "role", "canDoMaintenance", "password",
    "theme", "fontFamily", "fontSize", "highlightEffect", "notificationSound",
    "mobilePush", "createdAt", "branchId", "passwordChangedAt", "mustChangePassword",
    "lastLoginAt", "loginCount"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Create index on MFA enabled for faster lookups during login
CREATE INDEX IF NOT EXISTS "idx_user_mfa" ON "User"("mfaEnabled");
