ALTER TABLE "Meal" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Meal_userId_idempotencyKey_key" ON "Meal"("userId", "idempotencyKey");
