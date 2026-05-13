const { PrismaClient, GoalType, ActivityLevel, MealType } = require('@prisma/client');
const catalogData = require('../data/nutrition-catalog.json');

const prisma = new PrismaClient();

function dayOffset(days = 0) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function sourceName(id) {
  return catalogData.sources.find((source) => source.id === id)?.name ?? null;
}

async function seedNutritionCatalog() {
  await prisma.catalogAlias.deleteMany();
  await prisma.catalogFood.deleteMany();
  await prisma.nutritionSource.deleteMany();

  await prisma.nutritionSource.createMany({
    data: catalogData.sources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      brand: source.brand,
      citation: source.citation,
      notes: source.notes,
      active: true,
    })),
  });

  await prisma.catalogFood.createMany({
    data: catalogData.foods.map(({ aliases, ...food }) => food),
  });

  await prisma.catalogAlias.createMany({
    data: catalogData.foods.flatMap((food) =>
      food.aliases.map((alias) => ({
        foodId: food.id,
        alias,
        normalizedAlias: alias.toLowerCase(),
      }))
    ),
  });
}

async function main() {
  await prisma.reusableMealItem.deleteMany();
  await prisma.reusableMeal.deleteMany();
  await prisma.foodItem.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.weightEntry.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  await seedNutritionCatalog();

  const user = await prisma.user.create({
    data: {
      name: 'Tyler',
      email: 'tyler@example.com',
      demo: true,
      profile: {
        create: {
          age: 20,
          heightCm: 180,
          weightLbs: 182,
          goal: GoalType.LOSE_WEIGHT,
          activityLevel: ActivityLevel.MODERATE,
          dailyCalorieGoal: 2300,
          proteinGoal: 180,
          aiPreferenceNotes: 'Prioritize trusted catalog nutrition when available and keep clarification questions short.',
        },
      },
    },
  });

  const today = dayOffset(0);
  const yesterday = dayOffset(-1);
  const sixDaysAgo = dayOffset(-6);

  const meals = [
    {
      mealType: MealType.BREAKFAST,
      date: today,
      rawText: '3 scrambled eggs and sourdough toast',
      confidenceScore: 0.92,
      notes: 'Seed breakfast using trusted generic catalog entries',
      items: [
        {
          foodName: 'Large egg',
          quantity: 3,
          unit: 'egg',
          calories: 210,
          protein: 18,
          carbs: 1.8,
          fat: 15,
          fiber: 0,
          sugar: 0.6,
          sodium: 210,
          notes: 'Matched to trusted catalog entry from Generic nutrition reference',
          nutritionSourceType: 'GENERIC_REFERENCE',
          nutritionSourceName: sourceName('generic_reference'),
          catalogFoodId: 'generic_large_egg',
        },
        {
          foodName: 'Bread',
          quantity: 2,
          unit: 'slice',
          calories: 180,
          protein: 6,
          carbs: 34,
          fat: 2,
          fiber: 2,
          sugar: 2,
          sodium: 320,
          notes: 'Matched to trusted catalog entry from Generic nutrition reference',
          nutritionSourceType: 'GENERIC_REFERENCE',
          nutritionSourceName: sourceName('generic_reference'),
          catalogFoodId: 'generic_bread',
        },
      ],
    },
    {
      mealType: MealType.LUNCH,
      date: today,
      rawText: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
      confidenceScore: 0.94,
      notes: 'Seed lunch using trusted Chipotle catalog entries',
      items: [
        { foodName: 'Chipotle white rice', quantity: 1, unit: 'serving', calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sugar: 0, sodium: 350, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_white_rice' },
        { foodName: 'Chipotle chicken', quantity: 2, unit: 'serving', calories: 360, protein: 64, carbs: 2, fat: 14, fiber: 0, sugar: 0, sodium: 620, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_chicken' },
        { foodName: 'Chipotle cheese', quantity: 1, unit: 'serving', calories: 110, protein: 6, carbs: 1, fat: 8, fiber: 0, sugar: 0, sodium: 185, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_cheese' },
        { foodName: 'Chipotle corn salsa', quantity: 1, unit: 'serving', calories: 80, protein: 3, carbs: 16, fat: 1, fiber: 3, sugar: 4, sodium: 330, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_corn_salsa' },
        { foodName: 'Chipotle lettuce', quantity: 1, unit: 'serving', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sugar: 0, sodium: 5, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_lettuce' },
        { foodName: 'Chipotle tomatillo green salsa', quantity: 1, unit: 'serving', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 260, notes: 'Matched to trusted catalog entry from Chipotle official nutrition', nutritionSourceType: 'OFFICIAL_RESTAURANT', nutritionSourceName: sourceName('chipotle_official'), catalogFoodId: 'chipotle_green_salsa' },
      ],
    },
    {
      mealType: MealType.SNACK,
      date: yesterday,
      rawText: 'Protein shake with almond milk',
      confidenceScore: 0.91,
      notes: 'Seed snack using trusted generic catalog entries',
      items: [
        { foodName: 'Whey protein', quantity: 1, unit: 'scoop', calories: 120, protein: 24, carbs: 3, fat: 1.5, fiber: 0, sugar: 1, sodium: 120, notes: 'Matched to trusted catalog entry from Generic nutrition reference', nutritionSourceType: 'GENERIC_REFERENCE', nutritionSourceName: sourceName('generic_reference'), catalogFoodId: 'generic_whey_protein' },
        { foodName: 'Unsweetened almond milk', quantity: 1, unit: 'cup', calories: 30, protein: 1, carbs: 1, fat: 2.5, fiber: 0, sugar: 0, sodium: 170, notes: 'Matched to trusted catalog entry from Generic nutrition reference', nutritionSourceType: 'GENERIC_REFERENCE', nutritionSourceName: sourceName('generic_reference'), catalogFoodId: 'generic_almond_milk' },
      ],
    },
    {
      mealType: MealType.DINNER,
      date: yesterday,
      rawText: '6 oz grilled chicken and 1.5 cups rice',
      confidenceScore: 0.87,
      notes: 'Seed dinner using trusted generic catalog entries',
      items: [
        { foodName: 'Grilled chicken breast', quantity: 6, unit: 'oz', calories: 282, protein: 52.8, carbs: 0, fat: 6, fiber: 0, sugar: 0, sodium: 150, notes: 'Matched to trusted catalog entry from Generic nutrition reference', nutritionSourceType: 'GENERIC_REFERENCE', nutritionSourceName: sourceName('generic_reference'), catalogFoodId: 'generic_grilled_chicken_breast' },
        { foodName: 'Cooked white rice', quantity: 1.5, unit: 'cup', calories: 300, protein: 6, carbs: 66, fat: 0.6, fiber: 0.9, sugar: 0.15, sodium: 0, notes: 'Matched to trusted catalog entry from Generic nutrition reference', nutritionSourceType: 'GENERIC_REFERENCE', nutritionSourceName: sourceName('generic_reference'), catalogFoodId: 'generic_cooked_white_rice' },
      ],
    },
  ];

  const createdMeals = [];

  for (const meal of meals) {
    const totals = meal.items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat,
        fiber: acc.fiber + item.fiber,
        sugar: acc.sugar + item.sugar,
        sodium: acc.sodium + item.sodium,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

    const createdMeal = await prisma.meal.create({
      data: {
        userId: user.id,
        mealType: meal.mealType,
        date: meal.date,
        rawText: meal.rawText,
        notes: meal.notes,
        confidenceScore: meal.confidenceScore,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat,
        totalFiber: totals.fiber,
        totalSugar: totals.sugar,
        totalSodium: totals.sodium,
        items: {
          create: meal.items.map((item) => ({
            foodName: item.foodName,
            quantity: item.quantity,
            unit: item.unit,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            sodium: item.sodium,
            mealType: meal.mealType,
            date: meal.date,
            confidenceScore: meal.confidenceScore,
            notes: item.notes,
            nutritionSourceType: item.nutritionSourceType,
            nutritionSourceName: item.nutritionSourceName,
            catalogFoodId: item.catalogFoodId,
          })),
        },
      },
      include: { items: true },
    });

    createdMeals.push(createdMeal);
  }

  const breakfastMeal = createdMeals.find((meal) => meal.mealType === MealType.BREAKFAST);
  if (breakfastMeal) {
    await prisma.reusableMeal.create({
      data: {
        userId: user.id,
        sourceMealId: breakfastMeal.id,
        title: 'Quick eggs and toast',
        rawText: breakfastMeal.rawText,
        mealType: breakfastMeal.mealType,
        confidenceScore: breakfastMeal.confidenceScore,
        isFavorite: true,
        lastUsedAt: today,
        items: {
          create: breakfastMeal.items.map((item) => ({
            foodName: item.foodName,
            quantity: item.quantity,
            unit: item.unit,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            sodium: item.sodium,
            notes: item.notes,
            isTrusted: item.nutritionSourceType !== 'AI_ESTIMATE',
            sourceType: item.nutritionSourceType,
            sourceName: item.nutritionSourceName,
            catalogFoodId: item.catalogFoodId,
          })),
        },
      },
    });
  }

  await prisma.dailyLog.createMany({
    data: [
      { userId: user.id, date: sixDaysAgo, calories: 2140, protein: 162, carbs: 201, fat: 70, fiber: 24, sugar: 31, sodium: 1800 },
      { userId: user.id, date: dayOffset(-5), calories: 2285, protein: 175, carbs: 218, fat: 74, fiber: 22, sugar: 28, sodium: 2050 },
      { userId: user.id, date: dayOffset(-4), calories: 1980, protein: 154, carbs: 176, fat: 63, fiber: 20, sugar: 25, sodium: 1700 },
      { userId: user.id, date: dayOffset(-3), calories: 2415, protein: 181, carbs: 230, fat: 77, fiber: 25, sugar: 35, sodium: 2150 },
      { userId: user.id, date: dayOffset(-2), calories: 2210, protein: 168, carbs: 204, fat: 72, fiber: 23, sugar: 30, sodium: 1900 },
      { userId: user.id, date: yesterday, calories: 613, protein: 83.8, carbs: 67, fat: 9.1, fiber: 0.9, sugar: 1.15, sodium: 320 },
      { userId: user.id, date: today, calories: 1170, protein: 95, carbs: 94.8, fat: 44, fiber: 8, sugar: 7.6, sodium: 1860 },
    ],
  });

  await prisma.weightEntry.createMany({
    data: [
      { userId: user.id, date: dayOffset(-14), weightLbs: 184 },
      { userId: user.id, date: dayOffset(-7), weightLbs: 183 },
      { userId: user.id, date: today, weightLbs: 182 },
    ],
  });

  console.log('Seeded Calorie Compass demo data for Tyler.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
