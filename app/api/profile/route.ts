import { ActivityLevel, GoalType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const user = await saveProfile(payload);
    return NextResponse.json(user);
  } catch (error) {
    console.error('save profile error', error);
    return NextResponse.json({ error: 'Unable to save profile.' }, { status: 400 });
  }
}
