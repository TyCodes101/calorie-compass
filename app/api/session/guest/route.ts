import { NextResponse } from 'next/server';

import { buildAccountFoundationSnapshot, getPreferredUserName } from '@/lib/auth-session';
import { issueNativeGuestSession } from '@/lib/auth/native-session';
import { hasDatabaseConnectionString } from '@/lib/current-user';

export async function POST() {
  if (!hasDatabaseConnectionString()) {
    return NextResponse.json({
      account: buildAccountFoundationSnapshot({
        id: 'local-demo-user',
        name: 'Guest',
        email: 'local-demo@guest.caloriecompass.local',
        demo: true,
      }),
      user: {
        id: 'local-demo-user',
        name: null,
        mode: 'guest',
      },
      session: {
        token: 'local-demo-native-session',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        tokenType: 'Bearer',
      },
    });
  }

  const issued = await issueNativeGuestSession();

  return NextResponse.json({
    account: buildAccountFoundationSnapshot(issued.user),
    user: {
      id: issued.user.id,
      name: getPreferredUserName(issued.user),
      mode: 'guest',
    },
    session: {
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      tokenType: 'Bearer',
    },
  });
}
