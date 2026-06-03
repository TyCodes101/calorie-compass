import { NextResponse } from 'next/server';

import { deleteCustomFood } from '@/lib/custom-foods';
import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';

export async function DELETE(_request: Request, context: { params: Promise<{ customFoodId: string }> }) {
  const { customFoodId } = await context.params;

  try {
    await deleteCustomFood(customFoodId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logWriteFailure('custom-food.route.delete', error, { customFoodId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't delete that custom food right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't delete that custom food right now. Please try again." }, { status: 500 });
  }
}
