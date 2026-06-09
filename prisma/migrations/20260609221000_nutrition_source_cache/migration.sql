-- Cache external nutrition lookups (barcodes / queries) so future resolutions improve over time.

CREATE TYPE "CachedNutritionProvider" AS ENUM ('OPEN_FOOD_FACTS', 'USDA_FDC');

CREATE TABLE "CachedNutritionFood" (
    "id" TEXT NOT NULL,
    "provider" "CachedNutritionProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "barcode" TEXT,
    "normalizedQuery" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "servingQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "servingUnit" TEXT NOT NULL DEFAULT 'serving',
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedNutritionFood_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CachedNutritionFood_provider_providerId_key" ON "CachedNutritionFood"("provider", "providerId");
CREATE INDEX "CachedNutritionFood_barcode_idx" ON "CachedNutritionFood"("barcode");
CREATE INDEX "CachedNutritionFood_normalizedQuery_idx" ON "CachedNutritionFood"("normalizedQuery");
