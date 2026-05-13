import { NextResponse } from 'next/server';

import { exportAccountData } from '@/lib/account-data';
import { logWriteFailure } from '@/lib/persistence';

export async function GET() {
  try {
    const payload = await exportAccountData();
    return NextResponse.json(payload);
  } catch (error) {
    logWriteFailure('profile.export.route', error);
    return NextResponse.json({ error: 'We couldn’t export your data right now. Please try again.' }, { status: 500 });
  }
}
