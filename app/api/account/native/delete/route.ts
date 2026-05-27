import { NextResponse } from 'next/server';

import { deleteNativeAccount } from '@/lib/account-lifecycle';
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

export async function DELETE(request: Request) {
  const nativeSession = await getNativeAccountSessionFromRequest(request);
  if (!nativeSession.ok) {
    return nativeSessionErrorResponse(nativeSession);
  }

  const result = await deleteNativeAccount({
    accountUserId: nativeSession.session.userId,
  });

  return NextResponse.json({
    ok: true,
    code: 'NATIVE_ACCOUNT_DELETED',
    ...result,
  });
}
