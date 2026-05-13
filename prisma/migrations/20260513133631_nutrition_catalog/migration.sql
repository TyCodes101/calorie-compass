-- CreateTable
CREATE TABLE "NutritionSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "brand" TEXT,
    "citation" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogFood" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "brand" TEXT,
    "servingQuantity" REAL NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" REAL NOT NULL DEFAULT 0,
    "protein" REAL NOT NULL DEFAULT 0,
    "carbs" REAL NOT NULL DEFAULT 0,
    "fat" REAL NOT NULL DEFAULT 0,
    "fiber" REAL NOT NULL DEFAULT 0,
    "sugar" REAL NOT NULL DEFAULT 0,
    "sodium" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogFood_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NutritionSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "foodId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogAlias_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "CatalogFood" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FoodItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealId" TEXT NOT NULL,
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
    "mealType" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "confidenceScore" REAL,
    "notes" TEXT,
    "nutritionSourceType" TEXT,
    "nutritionSourceName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodItem_catalogFoodId_fkey" FOREIGN KEY ("catalogFoodId") REFERENCES "CatalogFood" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FoodItem" ("calories", "carbs", "confidenceScore", "createdAt", "date", "fat", "fiber", "foodName", "id", "mealId", "mealType", "notes", "protein", "quantity", "sodium", "sugar", "unit", "updatedAt") SELECT "calories", "carbs", "confidenceScore", "createdAt", "date", "fat", "fiber", "foodName", "id", "mealId", "mealType", "notes", "protein", "quantity", "sodium", "sugar", "unit", "updatedAt" FROM "FoodItem";
DROP TABLE "FoodItem";
ALTER TABLE "new_FoodItem" RENAME TO "FoodItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NutritionSource_sourceType_idx" ON "NutritionSource"("sourceType");

-- CreateIndex
CREATE INDEX "NutritionSource_brand_idx" ON "NutritionSource"("brand");

-- CreateIndex
CREATE INDEX "CatalogFood_brand_idx" ON "CatalogFood"("brand");

-- CreateIndex
CREATE INDEX "CatalogFood_sourceId_idx" ON "CatalogFood"("sourceId");

-- CreateIndex
CREATE INDEX "CatalogAlias_foodId_idx" ON "CatalogAlias"("foodId");

-- CreateIndex
CREATE INDEX "CatalogAlias_normalizedAlias_idx" ON "CatalogAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogAlias_foodId_normalizedAlias_key" ON "CatalogAlias"("foodId", "normalizedAlias");
