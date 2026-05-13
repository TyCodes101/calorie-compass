import { describe, expect, it } from 'vitest';
import { resolvePrismaDatabaseUrl } from '@/lib/prisma-database-url';

describe('resolvePrismaDatabaseUrl', () => {
  it('keeps the local development database URL outside Vercel', () => {
    expect(
      resolvePrismaDatabaseUrl(
        {
          DATABASE_URL: 'file:./dev.db',
        },
        '/workspace/calorie-compass',
      ),
    ).toBe('file:./dev.db');
  });

  it('switches Vercel production from the local dev database to the bundled demo database', () => {
    expect(
      resolvePrismaDatabaseUrl(
        {
          DATABASE_URL: 'file:./dev.db',
          VERCEL: '1',
        },
        '/var/task',
      ),
    ).toBe('file:/var/task/prisma/demo.db');
  });

  it('does not override a real hosted database URL on Vercel', () => {
    expect(
      resolvePrismaDatabaseUrl(
        {
          DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app',
          VERCEL: '1',
        },
        '/var/task',
      ),
    ).toBe('postgresql://user:pass@db.example.com:5432/app');
  });
});
