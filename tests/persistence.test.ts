import { describe, expect, it } from 'vitest';

import { getDatabaseDebugInfo, getPersistenceErrorMessage, isDatabaseWriteError } from '@/lib/persistence';

describe('persistence helpers', () => {
  it('returns safe user-facing save messages', () => {
    expect(getPersistenceErrorMessage('meal')).toBe('We couldn’t save your meal right now. Please try again.');
    expect(getPersistenceErrorMessage('favorite')).toBe('We couldn’t save your favorite right now. Please try again.');
    expect(getPersistenceErrorMessage('profile')).toBe('We couldn’t save your profile right now. Please try again.');
  });

  it('redacts connection info for postgres without exposing credentials', () => {
    expect(
      getDatabaseDebugInfo({
        VERCEL: '1',
        DATABASE_URL: 'postgresql://user:secret@ep-cool-db.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true',
        DATABASE_URL_UNPOOLED: 'postgresql://user:secret@ep-cool-db-direct.us-east-1.aws.neon.tech/neondb?sslmode=require',
      }),
    ).toEqual({
      runtime: 'vercel',
      runtimeConnection: {
        provider: 'postgresql',
        host: 'ep-cool-db.us-east-1.aws.neon.tech',
        database: 'neondb',
        pooled: true,
      },
      directConnection: {
        provider: 'postgresql',
        host: 'ep-cool-db-direct.us-east-1.aws.neon.tech',
        database: 'neondb',
        pooled: false,
      },
    });
  });

  it('detects database write failures from prisma-like errors', () => {
    expect(isDatabaseWriteError(new Error('attempt to write a readonly database'))).toBe(true);
    expect(isDatabaseWriteError(new Error('ConnectorError: database write failed'))).toBe(true);
    expect(isDatabaseWriteError(new Error('Plain validation message'))).toBe(false);
  });
});
