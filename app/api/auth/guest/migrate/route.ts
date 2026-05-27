import { NextResponse } from 'next/server';

import { migrateGuestDataToAccount, readGuestSessionIdFromRequest } from '@/lib/account-lifecycle';
import { getNativeAccountSessionFromRequest } from '@/lib/auth/native-session';

function nativeSessionErrorResponse(result: Extract<Awaited<ReturnType<typeof getNativeAccountSessionFromRequest>>, { ok: false }>) {
  return NextResponse.json(
    {
      ok: false,
      code: result.code,
      error: result.error,
    },
    { status: result.status },
  );
}

export async function POST(request: Request) {
  const nativeSession = await getNativeAccountSessionFromRequest(request);
  if (!nativeSession.ok) {
    return nativeSessionErrorResponse(nativeSession);
  }

  const result = await migrateGuestDataToAccount({
    guestSessionId: readGuestSessionIdFromRequest(request),
    accountUserId: nativeSession.session.userId,
  });

  return NextResponse.json({
    ok: true,
    code: result.status === 'migrated' ? 'GUEST_DATA_MIGRATION_COMPLETED' : 'GUEST_DATA_MIGRATION_SKIPPED',
    result,
  });
}
