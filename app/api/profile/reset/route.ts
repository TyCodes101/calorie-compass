import { NextResponse } from 'next/server';

import { resetDemoData } from '@/lib/account-data';
import { logWriteFailure } from '@/lib/persistence';

export async function POST() {
  try {
    const result = await resetDemoData();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    logWriteFailure('profile.reset.route', error);
    return NextResponse.json({ error: 'We couldn’t reset your meal history right now. Please try again.' }, { status: 500 });
  }
}
