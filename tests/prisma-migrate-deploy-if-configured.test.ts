import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getPrismaMigrationPlan } from '../scripts/prisma-migrate-deploy-if-configured.mjs';

describe('Prisma migration deploy build guard', () => {
  it('skips safely when DATABASE_URL is not configured', () => {
    const plan = getPrismaMigrationPlan({}, process.cwd());

    expect(plan.shouldRun).toBe(false);
    expect(plan.reason).toMatch(/DATABASE_URL/i);
  });

  it('honors the explicit skip override', () => {
    const plan = getPrismaMigrationPlan(
      {
        DATABASE_URL: 'postgresql://example.invalid/macromesh',
        SKIP_PRISMA_MIGRATE_DEPLOY: '1',
      },
      process.cwd()
    );

    expect(plan.shouldRun).toBe(false);
    expect(plan.reason).toMatch(/skip/i);
  });

  it('plans to deploy migrations when a production database URL is present', () => {
    const plan = getPrismaMigrationPlan(
      {
        DATABASE_URL: 'postgresql://example.invalid/macromesh',
      },
      process.cwd()
    );

    expect(plan.shouldRun).toBe(true);
    expect(plan.command).toContain('prisma');
    expect(plan.args).toEqual(['migrate', 'deploy']);
  });

  it('wires the migration guard into npm build so TestFlight deploys have the current schema', () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toMatch(/prisma-migrate-deploy-if-configured/);
    expect(packageJson.scripts?.build).toMatch(/next build/);
  });
});
