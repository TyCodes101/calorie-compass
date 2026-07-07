-- Persist pending-meal idempotency metadata so retries and repeated taps cannot create duplicate meals.

ALTER TABLE "Meal"
ADD COLUMN "pendingMealId" TEXT,
ADD COLUMN "pendingMealVersion" INTEGER,
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Meal_userId_idempotencyKey_key" ON "Meal"("userId", "idempotencyKey");
