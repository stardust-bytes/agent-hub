-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentFile" ("createdAt", "filename", "id", "path", "sessionId") SELECT "createdAt", "filename", "id", "path", "sessionId" FROM "AgentFile";
DROP TABLE "AgentFile";
ALTER TABLE "new_AgentFile" RENAME TO "AgentFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
