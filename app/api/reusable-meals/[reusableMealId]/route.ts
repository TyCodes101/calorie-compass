import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { removeFavoriteMealTemplate } from '@/lib/reusable-meals';

const patchSchema = z.object({
  is_favorite: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ reusableMealId: string }> }) {
  const { reusableMealId } = await context.params;

  try {
    const user = await getCurrentUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: 'No user found. Complete onboarding first.' }, { status: 404 });
    }

    const patch = patchSchema.parse(await request.json());
    const updated = await prisma.reusableMeal.updateMany({
      where: {
        id: reusableMealId,
        userId: user.id,
      },
      data: {
        isFavorite: patch.is_favorite,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Favorite meal not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logWriteFailure('favorite.route.patch', error, { reusableMealId });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "We couldn't update that favorite right now. Please try again." }, { status: 400 });
    }

    return NextResponse.json({ error: "We couldn't update that favorite right now. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ reusableMealId: string }> }) {
  const { reusableMealId } = await context.params;

  try {
    await removeFavoriteMealTemplate(reusableMealId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logWriteFailure('favorite.route.delete', error, { reusableMealId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't remove that favorite right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't remove that favorite right now. Please try again." }, { status: 500 });
  }
}
