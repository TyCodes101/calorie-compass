-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "NutritionSourceType" AS ENUM ('OFFICIAL_RESTAURANT', 'GENERIC_REFERENCE', 'AI_ESTIMATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "heightCm" INTEGER,
    "weightLbs" DOUBLE PRECISION,
    "goal" "GoalType" NOT NULL DEFAULT 'MAINTAIN',
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "dailyCalorieGoal" INTEGER NOT NULL DEFAULT 2200,
    "proteinGoal" INTEGER NOT NULL DEFAULT 160,
    "aiPreferenceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT,
    "notes" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "totalCalories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "catalogFoodId" TEXT,
    "foodName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mealType" "MealType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "notes" TEXT,
    "nutritionSourceType" "NutritionSourceType",
    "nutritionSourceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReusableMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceMealId" TEXT,
    "title" TEXT NOT NULL,
    "rawText" TEXT,
    "mealType" "MealType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "isFavorite" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReusableMealItem" (
    "id" TEXT NOT NULL,
    "reusableMealId" TEXT NOT NULL,
    "catalogFoodId" TEXT,
    "foodName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" "NutritionSourceType",
    "sourceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableMealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightLbs" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "NutritionSourceType" NOT NULL,
    "brand" TEXT,
    "citation" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogFood" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "brand" TEXT,
    "servingQuantity" DOUBLE PRECISION NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogAlias" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "Meal_userId_date_idx" ON "Meal"("userId", "date");

-- CreateIndex
CREATE INDEX "ReusableMeal_userId_isFavorite_idx" ON "ReusableMeal"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "ReusableMeal_userId_lastUsedAt_idx" ON "ReusableMeal"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReusableMeal_userId_sourceMealId_key" ON "ReusableMeal"("userId", "sourceMealId");

-- CreateIndex
CREATE INDEX "ReusableMealItem_reusableMealId_idx" ON "ReusableMealItem"("reusableMealId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_userId_date_key" ON "DailyLog"("userId", "date");

-- CreateIndex
CREATE INDEX "WeightEntry_userId_date_idx" ON "WeightEntry"("userId", "date");

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

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_catalogFoodId_fkey" FOREIGN KEY ("catalogFoodId") REFERENCES "CatalogFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableMeal" ADD CONSTRAINT "ReusableMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableMeal" ADD CONSTRAINT "ReusableMeal_sourceMealId_fkey" FOREIGN KEY ("sourceMealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableMealItem" ADD CONSTRAINT "ReusableMealItem_reusableMealId_fkey" FOREIGN KEY ("reusableMealId") REFERENCES "ReusableMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableMealItem" ADD CONSTRAINT "ReusableMealItem_catalogFoodId_fkey" FOREIGN KEY ("catalogFoodId") REFERENCES "CatalogFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogFood" ADD CONSTRAINT "CatalogFood_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NutritionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogAlias" ADD CONSTRAINT "CatalogAlias_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "CatalogFood"("id") ON DELETE CASCADE ON UPDATE CASCADE;
