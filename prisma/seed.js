const { PrismaClient, GoalType, ActivityLevel, MealType } = require('@prisma/client');

const prisma = new PrismaClient();

function dayOffset(days = 0) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function main() {
  await prisma.foodItem.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.weightEntry.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

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
          aiPreferenceNotes: 'Prioritize reasonable restaurant estimates and keep clarification questions short.',
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
      confidenceScore: 0.9,
      notes: 'Seed breakfast',
      items: [
        { foodName: 'Scrambled eggs', quantity: 3, unit: 'large eggs', calories: 210, protein: 18, carbs: 2, fat: 15, fiber: 0, sugar: 1, sodium: 210, notes: '3 eggs' },
        { foodName: 'Sourdough toast', quantity: 2, unit: 'slices', calories: 180, protein: 6, carbs: 34, fat: 2, fiber: 2, sugar: 2, sodium: 320, notes: 'Plain toast' },
      ],
    },
    {
      mealType: MealType.LUNCH,
      date: today,
      rawText: 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
      confidenceScore: 0.88,
      notes: 'Seed lunch',
      items: [
        { foodName: 'Chipotle white rice', quantity: 1, unit: 'serving', calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sugar: 0, sodium: 350, notes: 'Typical serving' },
        { foodName: 'Chipotle chicken', quantity: 2, unit: 'servings', calories: 360, protein: 64, carbs: 2, fat: 14, fiber: 0, sugar: 0, sodium: 620, notes: 'Double chicken' },
        { foodName: 'Cheese', quantity: 1, unit: 'serving', calories: 110, protein: 6, carbs: 1, fat: 8, fiber: 0, sugar: 0, sodium: 185, notes: 'Shredded cheese' },
        { foodName: 'Corn salsa', quantity: 1, unit: 'serving', calories: 80, protein: 3, carbs: 16, fat: 1, fiber: 3, sugar: 4, sodium: 330, notes: 'Typical serving' },
        { foodName: 'Lettuce', quantity: 1, unit: 'serving', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sugar: 0, sodium: 5, notes: 'Romaine lettuce' },
        { foodName: 'Tomatillo green salsa', quantity: 1, unit: 'serving', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 260, notes: 'Green salsa' },
      ],
    },
    {
      mealType: MealType.SNACK,
      date: yesterday,
      rawText: 'Protein shake with almond milk',
      confidenceScore: 0.93,
      notes: 'Seed snack',
      items: [
        { foodName: 'Whey protein shake', quantity: 1, unit: 'shake', calories: 170, protein: 30, carbs: 5, fat: 3, fiber: 1, sugar: 2, sodium: 180, notes: 'One scoop with almond milk' },
      ],
    },
    {
      mealType: MealType.DINNER,
      date: yesterday,
      rawText: 'Chicken and rice',
      confidenceScore: 0.76,
      notes: 'Seed dinner',
      items: [
        { foodName: 'Grilled chicken breast', quantity: 6, unit: 'oz', calories: 280, protein: 53, carbs: 0, fat: 6, fiber: 0, sugar: 0, sodium: 150, notes: 'Approximate portion' },
        { foodName: 'Cooked white rice', quantity: 1.5, unit: 'cups', calories: 300, protein: 6, carbs: 66, fat: 1, fiber: 1, sugar: 0, sodium: 0, notes: 'Approximate portion' },
      ],
    },
  ];

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

    await prisma.meal.create({
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
      { userId: user.id, date: yesterday, calories: 750, protein: 89, carbs: 71, fat: 10, fiber: 2, sugar: 2, sodium: 330 },
      { userId: user.id, date: today, calories: 1170, protein: 91, carbs: 97, fat: 30, fiber: 8, sugar: 8, sodium: 1660 },
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
