import { ActivityLevel, GoalType } from '@prisma/client';

import { getCurrentUserWithProfile } from '@/lib/current-user';
import { logConnectionReady, logWriteFailure, logWriteStart, logWriteSuccess } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';

export type ProfileInput = {
  name: string;
  age?: number | null;
  heightCm?: number | null;
  weightLbs?: number | null;
  goal: keyof typeof GoalType;
  activityLevel: keyof typeof ActivityLevel;
  dailyCalorieGoal: number;
  proteinGoal: number;
  nutritionPreferences?: string | null;
};

export async function saveProfile(input: ProfileInput) {
  logWriteStart('profile.save', {
    nameLength: input.name.length,
    goal: input.goal,
    activityLevel: input.activityLevel,
  });

  try {
    await prisma.$connect();
    logConnectionReady('profile.save', {
      goal: input.goal,
    });

    const existingUser = await getCurrentUserWithProfile();

    if (!existingUser) {
      const createdUser = await prisma.user.create({
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
              aiPreferenceNotes: input.nutritionPreferences?.trim() || null,
            },
          },
        },
        include: { profile: true },
      });

      logWriteSuccess('profile.save', {
        userId: createdUser.id,
        created: true,
      });

      return createdUser;
    }

    const updatedUser = await prisma.user.update({
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
              aiPreferenceNotes: input.nutritionPreferences?.trim() || null,
            },
            update: {
              age: input.age,
              heightCm: input.heightCm,
              weightLbs: input.weightLbs,
              goal: input.goal,
              activityLevel: input.activityLevel,
              dailyCalorieGoal: input.dailyCalorieGoal,
              proteinGoal: input.proteinGoal,
              aiPreferenceNotes: input.nutritionPreferences?.trim() || null,
            },
          },
        },
      },
      include: { profile: true },
    });

    logWriteSuccess('profile.save', {
      userId: updatedUser.id,
      created: false,
    });

    return updatedUser;
  } catch (error) {
    logWriteFailure('profile.save', error, {
      goal: input.goal,
      activityLevel: input.activityLevel,
    });
    throw error;
  }
}
