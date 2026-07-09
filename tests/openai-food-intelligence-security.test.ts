import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const ignoredDirs = new Set(['.git', '.next', 'coverage', 'node_modules']);
const scanRoots = [
  '.github',
  'app',
  'components',
  'docs',
  'ios',
  'lib',
  'prisma',
  'scripts',
  'tests',
  '.env.example',
  'codemagic.yaml',
  'eslint.config.mjs',
  'next.config.ts',
  'package.json',
  'proxy.ts',
  'README.md',
  'tsconfig.json',
  'vitest.config.ts',
  'vitest.setup.ts',
];

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return ignoredDirs.has(entry) ? [] : walkFiles(fullPath);
    }
    return [fullPath];
  });
}

function scanSourceFiles() {
  return scanRoots.flatMap((entry) => {
    const fullPath = join(repoRoot, entry);
    try {
      const stat = statSync(fullPath);
      return stat.isDirectory() ? walkFiles(fullPath) : [fullPath];
    } catch {
      return [];
    }
  });
}

function repoRelative(file: string) {
  return relative(repoRoot, file).replace(/\\/g, '/');
}

describe('OpenAI food intelligence security boundaries', () => {
  it('does not expose an OpenAI API key through public env names', () => {
    const matches = scanSourceFiles()
      .filter((file) => !file.includes(`${join('tests', 'openai-food-intelligence-security.test.ts')}`))
      .filter((file) => /\.(ts|tsx|js|jsx|swift|md|yaml|yml|env|example)$/.test(file))
      .filter((file) => /(?:process\.env\.NEXT_PUBLIC_OPENAI_API_KEY|NEXT_PUBLIC_OPENAI_API_KEY\s*=)/.test(readFileSync(file, 'utf8')));

    expect(matches).toEqual([]);
  });

  it('does not commit real-looking OpenAI keys', () => {
    const matches = scanSourceFiles()
      .filter((file) => !file.includes(`${join('tests', 'openai-food-intelligence-security.test.ts')}`))
      .filter((file) => /\.(ts|tsx|js|jsx|swift|md|yaml|yml|env|example|mjs)$/.test(file))
      .flatMap((file) => {
        const content = readFileSync(file, 'utf8');
        return content.match(/\bsk-(?!\.\.\.)[A-Za-z0-9_-]{20,}\b/g)?.map((key) => `${repoRelative(file)}:${key.slice(0, 8)}`) ?? [];
      });

    expect(matches).toEqual([]);
  });

  it('does not expose OpenAI env vars through Next public config', () => {
    const configFiles = ['next.config.ts', 'next.config.js', 'next.config.mjs']
      .map((file) => join(repoRoot, file))
      .filter((file) => {
        try {
          return statSync(file).isFile();
        } catch {
          return false;
        }
      });

    const matches = configFiles
      .filter((file) => /env\s*:|NEXT_PUBLIC_OPENAI|OPENAI_API_KEY/i.test(readFileSync(file, 'utf8')))
      .map(repoRelative);

    expect(matches).toEqual([]);
  });

  it('keeps OpenAI SDK calls out of browser/client code', () => {
    const clientFiles = scanSourceFiles()
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
      .filter((file) => {
        const rel = repoRelative(file);
        const content = readFileSync(file, 'utf8');
        return rel.startsWith('components/')
          || (rel.startsWith('app/') && !rel.startsWith('app/api/') && /^['"]use client['"]/.test(content.trimStart()));
      });

    const matches = clientFiles
      .filter((file) => /from ['"]openai['"]|new OpenAI|OPENAI_API_KEY|api\.openai\.com|NEXT_PUBLIC_OPENAI/i.test(readFileSync(file, 'utf8')))
      .map(repoRelative);

    expect(matches).toEqual([]);
  });

  it('keeps OpenAI calls out of Swift/iOS sources', () => {
    const swiftMatches = walkFiles(join(repoRoot, 'ios'))
      .filter((file) => file.endsWith('.swift'))
      .filter((file) => /OpenAI|OPENAI_API_KEY|api\.openai\.com/i.test(readFileSync(file, 'utf8')));

    expect(swiftMatches).toEqual([]);
  });

  it('keeps the real OpenAI smoke script read-only and non-persistent', () => {
    const script = readFileSync(join(repoRoot, 'scripts', 'smoke-openai-food-intelligence.mjs'), 'utf8');

    expect(script).not.toMatch(/prisma|saveConfirmedMeal|\/api\/meals|POST/i);
    expect(script).not.toMatch(/console\.log\([^)]*apiKey/i);
    expect(script).toMatch(/redact/i);
    expect(script).toMatch(/OPENAI_API_KEY/);
  });
});
