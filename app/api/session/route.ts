import { NextResponse } from 'next/server';

import { buildAccountFoundationSnapshot, getPreferredUserName, isGuestUser } from '@/lib/auth-session';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export async function GET() {
  const user = await getCurrentUserWithProfile();
  const account = buildAccountFoundationSnapshot(user);

  return NextResponse.json({
    account,
    user: user
      ? {
          id: user.id,
          name: getPreferredUserName(user),
          mode: isGuestUser(user) ? 'guest' : 'account',
        }
      : null,
  });
}
