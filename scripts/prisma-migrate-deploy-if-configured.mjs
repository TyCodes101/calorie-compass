import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function truthy(value) {
  return /^(1|true|yes)$/i.test(String(value ?? '').trim());
}

function resolvePrismaCommand(cwd = process.cwd()) {
  const binaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const localBinary = path.join(cwd, 'node_modules', '.bin', binaryName);
  if (existsSync(localBinary)) {
    return localBinary;
  }

  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

export function getPrismaMigrationPlan(env = process.env, cwd = process.cwd()) {
  if (truthy(env.SKIP_PRISMA_MIGRATE_DEPLOY)) {
    return {
      shouldRun: false,
      reason: 'SKIP_PRISMA_MIGRATE_DEPLOY is set.',
      command: null,
      args: [],
    };
  }

  const databaseUrl = String(env.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    return {
      shouldRun: false,
      reason: 'DATABASE_URL is not configured.',
      command: null,
      args: [],
    };
  }

  if (/^file:/i.test(databaseUrl)) {
    return {
      shouldRun: false,
      reason: 'DATABASE_URL points to a local file database.',
      command: null,
      args: [],
    };
  }

  const command = resolvePrismaCommand(cwd);
  const args = path.basename(command).startsWith('npx')
    ? ['prisma', 'migrate', 'deploy']
    : ['migrate', 'deploy'];

  return {
    shouldRun: true,
    reason: 'DATABASE_URL is configured.',
    command,
    args,
  };
}

function run() {
  const plan = getPrismaMigrationPlan(process.env, process.cwd());

  if (!plan.shouldRun) {
    console.log(`[prisma] Skipping migration deploy: ${plan.reason}`);
    return 0;
  }

  if (truthy(process.env.PRISMA_MIGRATE_DEPLOY_DRY_RUN)) {
    console.log(`[prisma] Dry run: ${plan.command} ${plan.args.join(' ')}`);
    return 0;
  }

  console.log('[prisma] Deploying database migrations before build.');
  const result = spawnSync(plan.command, plan.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`[prisma] Failed to start migration deploy: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath === fileURLToPath(import.meta.url)) {
  process.exitCode = run();
}
