import { ActivityLevel, GoalType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUserWithProfile } from '@/lib/current-user';
import { getPersistenceErrorMessage, isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { buildProfileSettingsSnapshot } from '@/lib/profile-settings';
import { saveProfile } from '@/lib/profile';

const requestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
  heightCm: z.number().int().positive().optional(),
  weightLbs: z.number().positive().optional(),
  goal: z.nativeEnum(GoalType),
  activityLevel: z.nativeEnum(ActivityLevel),
  dailyCalorieGoal: z.number().int().positive(),
  proteinGoal: z.number().int().positive(),
  nutritionPreferences: z.string().max(500).nullable().optional(),
});

const patchSchema = requestSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, { message: 'At least one setting is required.' });

export async function GET() {
  try {
    return NextResponse.json(buildProfileSettingsSnapshot(await getCurrentUserWithProfile()));
  } catch (error) {
    logWriteFailure('profile.route.get', error);
    return NextResponse.json({
      ...buildProfileSettingsSnapshot(null),
      name: 'Guest',
      nutritionPreferences: '',
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const user = await saveProfile(payload);
    return NextResponse.json(buildProfileSettingsSnapshot(user));
  } catch (error) {
    logWriteFailure('profile.route', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const patch = patchSchema.parse(body);
    const current = buildProfileSettingsSnapshot(await getCurrentUserWithProfile());
    const payload = {
      ...current,
      ...patch,
      name: typeof patch.name === 'string' ? patch.name.trim() : current.name,
    };

    const user = await saveProfile(payload);
    return NextResponse.json(buildProfileSettingsSnapshot(user));
  } catch (error) {
    logWriteFailure('profile.route.patch', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('profile') }, { status: 500 });
  }
}
