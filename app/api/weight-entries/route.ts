import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { startOfDayUtc } from '@/lib/date';
import { summarizeWeightTrend } from '@/lib/growth-metrics';
import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';

const requestSchema = z.object({
  weightLbs: z.number().positive().max(1000),
  date: z.string().optional(),
});

function mapEntry(entry: { id: string; date: Date; weightLbs: number }) {
  return {
    id: entry.id,
    date: entry.date.toISOString(),
    weightLbs: entry.weightLbs,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUserWithProfile();

    if (!user || !hasDatabaseConnectionString()) {
      return NextResponse.json({ entries: [], trend: summarizeWeightTrend([]) });
    }

    const entries = await prisma.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 30,
    });

    return NextResponse.json({
      entries: entries.map(mapEntry),
      trend: summarizeWeightTrend(entries),
    });
  } catch (error) {
    logWriteFailure('weight.route.get', error);
    return NextResponse.json({ entries: [], trend: summarizeWeightTrend([]) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: 'No user found. Complete onboarding first.' }, { status: 404 });
    }

    if (!hasDatabaseConnectionString()) {
      return NextResponse.json({ error: 'Weight tracking needs a live backend before it can sync.' }, { status: 503 });
    }

    const payload = requestSchema.parse(await request.json());
    const entry = await prisma.weightEntry.create({
      data: {
        userId: user.id,
        date: startOfDayUtc(payload.date ?? new Date()),
        weightLbs: payload.weightLbs,
      },
    });

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { weightLbs: payload.weightLbs },
    });

    return NextResponse.json({ entry: mapEntry(entry) });
  } catch (error) {
    logWriteFailure('weight.route.post', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Enter a valid weight before saving.' }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't save that weight entry right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't save that weight entry right now. Please try again." }, { status: 500 });
  }
}
