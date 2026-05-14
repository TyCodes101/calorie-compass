import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { guestSessionCookieName } from '@/lib/auth-session';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(guestSessionCookieName)?.value) {
    response.cookies.set({
      name: guestSessionCookieName,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
