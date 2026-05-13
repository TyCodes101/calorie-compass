import { NextResponse } from 'next/server';

import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { removeFavoriteMealTemplate } from '@/lib/reusable-meals';

export async function DELETE(_request: Request, context: { params: Promise<{ reusableMealId: string }> }) {
  const { reusableMealId } = await context.params;

  try {
    await removeFavoriteMealTemplate(reusableMealId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logWriteFailure('favorite.route.delete', error, { reusableMealId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: 'We couldn’t remove that favorite right now. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ error: 'We couldn’t remove that favorite right now. Please try again.' }, { status: 500 });
  }
}
