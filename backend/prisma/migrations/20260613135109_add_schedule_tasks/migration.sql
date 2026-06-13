-- CreateTable
CREATE TABLE "ScheduleTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'manual',
    "cronMinute" INTEGER,
    "cronHour" INTEGER,
    "cronDayOfWeek" INTEGER,
    "modelId" INTEGER,
    "projectPath" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleTaskLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleTaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ScheduleTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mode" TEXT NOT NULL DEFAULT 'cowork',
    "title" TEXT NOT NULL DEFAULT 'New Session',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Session" ("createdAt", "id", "mode", "title", "updatedAt") SELECT "createdAt", "id", "mode", "title", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
