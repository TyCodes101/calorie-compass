import { NextResponse } from 'next/server';

import { exportNativeAccountData } from '@/lib/account-lifecycle';
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

export async function GET(request: Request) {
  const nativeSession = await getNativeAccountSessionFromRequest(request);
  if (!nativeSession.ok) {
    return nativeSessionErrorResponse(nativeSession);
  }

  const payload = await exportNativeAccountData({ accountUserId: nativeSession.session.userId });
  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        code: 'NATIVE_ACCOUNT_NOT_FOUND',
        error: 'No native account was found for this session.',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    code: 'NATIVE_ACCOUNT_EXPORT_READY',
    ...payload,
  });
}
