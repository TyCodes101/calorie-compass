import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (['node_modules', '.next', '.git'].includes(name)) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
  });
}

describe('nutrition provider secret boundaries', () => {
  it('keeps Calorie API out of public environment variables and the native client', () => {
    const files = [
      'ios/CalorieCompassApp.swift',
      'ios/APIClient.swift',
      'ios/CalorieCompass/BackendService.swift',
      'next.config.ts',
    ];
    const contents = files
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n');
    expect(contents).not.toMatch(/CALORIE_API_KEY|X-API-Key|calorieapiadmin\.com|NEXT_PUBLIC_CALORIE/i);
  });

  it('contains no NEXT_PUBLIC provider secret declaration in tracked source', () => {
    const files = [
      '.env.example',
      'lib/nutrition/providers/providerConfig.ts',
      'lib/nutrition/providers/calorieApi.ts',
      'lib/nutrition/providers/fatsecret.ts',
    ];
    const contents = files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n');
    expect(contents).not.toMatch(/NEXT_PUBLIC_(?:CALORIE_API|FATSECRET)/);
  });

  it('does not import server nutrition providers from client components', () => {
    const clientImports = sourceFiles(root)
      .map((file) => ({ file, contents: readFileSync(file, 'utf8') }))
      .filter(({ contents }) => /^\s*['"]use client['"];?/m.test(contents))
      .filter(({ contents }) => /nutrition\/providers|providerRegistry/.test(contents));
    expect(clientImports.map(({ file }) => file)).toEqual([]);
  });

  it('keeps local environment files ignored', () => {
    const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/\.env\*/);
    expect(gitignore).toMatch(/!\.env\.example/);
  });

  it('does not permit provider food IDs to become arbitrary detail paths', async () => {
    const { calorieApiProvider } = await import('@/lib/nutrition/providers/calorieApi');
    const originalFetch = globalThis.fetch;
    let called = false;
    vi.stubEnv('CALORIE_API_KEY', 'security-test-key');
    globalThis.fetch = (() => { called = true; throw new Error('should not fetch'); }) as typeof fetch;
    try {
      expect(await calorieApiProvider.getFoodDetails?.({ providerFoodId: '../admin', mealType: 'snack' })).toBeNull();
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    }
  });
});
