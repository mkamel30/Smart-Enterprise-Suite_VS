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
    "fontSize" TEXT DEFAULT 'medium',
    "highlightEffect" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "mobilePush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "id", "password", "role", "theme", "uid") SELECT "branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "id", "password", "role", "theme", "uid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
