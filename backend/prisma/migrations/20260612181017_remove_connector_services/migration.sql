/*
  Warnings:

  - You are about to drop the column `services` on the `Connector` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "account" TEXT,
    "config" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Connector" ("account", "config", "createdAt", "enabled", "id", "type", "updatedAt") SELECT "account", "config", "createdAt", "enabled", "id", "type", "updatedAt" FROM "Connector";
DROP TABLE "Connector";
ALTER TABLE "new_Connector" RENAME TO "Connector";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
