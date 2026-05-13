import { ActivityLevel, GoalType } from '@prisma/client';

export type ProfileSettingsSnapshot = {
  name: string;
  age?: number | null;
  heightCm?: number | null;
  weightLbs?: number | null;
  goal: GoalType;
  activityLevel: ActivityLevel;
  dailyCalorieGoal: number;
  proteinGoal: number;
};

type CurrentUserLike = {
  name: string;
  profile?: {
    age?: number | null;
    heightCm?: number | null;
    weightLbs?: number | null;
    goal?: GoalType | null;
    activityLevel?: ActivityLevel | null;
    dailyCalorieGoal?: number | null;
    proteinGoal?: number | null;
  } | null;
} | null;

export const defaultProfileSettings: ProfileSettingsSnapshot = {
  name: 'Tyler',
  age: undefined,
  heightCm: undefined,
  weightLbs: undefined,
  goal: GoalType.MAINTAIN,
  activityLevel: ActivityLevel.MODERATE,
  dailyCalorieGoal: 2200,
  proteinGoal: 160,
};

export function buildProfileSettingsSnapshot(user: CurrentUserLike): ProfileSettingsSnapshot {
  return {
    name: user?.name ?? defaultProfileSettings.name,
    age: user?.profile?.age ?? defaultProfileSettings.age,
    heightCm: user?.profile?.heightCm ?? defaultProfileSettings.heightCm,
    weightLbs: user?.profile?.weightLbs ?? defaultProfileSettings.weightLbs,
    goal: user?.profile?.goal ?? defaultProfileSettings.goal,
    activityLevel: user?.profile?.activityLevel ?? defaultProfileSettings.activityLevel,
    dailyCalorieGoal: user?.profile?.dailyCalorieGoal ?? defaultProfileSettings.dailyCalorieGoal,
    proteinGoal: user?.profile?.proteinGoal ?? defaultProfileSettings.proteinGoal,
  };
}
