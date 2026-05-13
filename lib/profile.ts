import { ActivityLevel, GoalType } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type ProfileInput = {
  name: string;
  age?: number;
  heightCm?: number;
  weightLbs?: number;
  goal: keyof typeof GoalType;
  activityLevel: keyof typeof ActivityLevel;
  dailyCalorieGoal: number;
  proteinGoal: number;
};

export async function saveProfile(input: ProfileInput) {
  const existingUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!existingUser) {
    return prisma.user.create({
      data: {
        name: input.name,
        demo: true,
        profile: {
          create: {
            age: input.age,
            heightCm: input.heightCm,
            weightLbs: input.weightLbs,
            goal: input.goal,
            activityLevel: input.activityLevel,
            dailyCalorieGoal: input.dailyCalorieGoal,
            proteinGoal: input.proteinGoal,
          },
        },
      },
      include: { profile: true },
    });
  }

  return prisma.user.update({
    where: { id: existingUser.id },
    data: {
      name: input.name,
      profile: {
        upsert: {
          create: {
            age: input.age,
            heightCm: input.heightCm,
            weightLbs: input.weightLbs,
            goal: input.goal,
            activityLevel: input.activityLevel,
            dailyCalorieGoal: input.dailyCalorieGoal,
            proteinGoal: input.proteinGoal,
          },
          update: {
            age: input.age,
            heightCm: input.heightCm,
            weightLbs: input.weightLbs,
            goal: input.goal,
            activityLevel: input.activityLevel,
            dailyCalorieGoal: input.dailyCalorieGoal,
            proteinGoal: input.proteinGoal,
          },
        },
      },
    },
    include: { profile: true },
  });
}
