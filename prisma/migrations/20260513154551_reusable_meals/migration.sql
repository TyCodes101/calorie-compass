-- CreateTable
CREATE TABLE "ReusableMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceMealId" TEXT,
    "title" TEXT NOT NULL,
    "rawText" TEXT,
    "mealType" TEXT NOT NULL,
    "confidenceScore" REAL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReusableMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReusableMeal_sourceMealId_fkey" FOREIGN KEY ("sourceMealId") REFERENCES "Meal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReusableMealItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reusableMealId" TEXT NOT NULL,
    "catalogFoodId" TEXT,
    "foodName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" REAL NOT NULL DEFAULT 0,
    "protein" REAL NOT NULL DEFAULT 0,
    "carbs" REAL NOT NULL DEFAULT 0,
    "fat" REAL NOT NULL DEFAULT 0,
    "fiber" REAL NOT NULL DEFAULT 0,
    "sugar" REAL NOT NULL DEFAULT 0,
    "sodium" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT,
    "sourceName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReusableMealItem_reusableMealId_fkey" FOREIGN KEY ("reusableMealId") REFERENCES "ReusableMeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReusableMealItem_catalogFoodId_fkey" FOREIGN KEY ("catalogFoodId") REFERENCES "CatalogFood" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReusableMeal_userId_isFavorite_idx" ON "ReusableMeal"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "ReusableMeal_userId_lastUsedAt_idx" ON "ReusableMeal"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReusableMeal_userId_sourceMealId_key" ON "ReusableMeal"("userId", "sourceMealId");

-- CreateIndex
CREATE INDEX "ReusableMealItem_reusableMealId_idx" ON "ReusableMealItem"("reusableMealId");
