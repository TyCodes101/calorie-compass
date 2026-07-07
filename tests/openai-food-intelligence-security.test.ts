import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const ignoredDirs = new Set(['.git', '.next', 'node_modules']);

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

describe('OpenAI food intelligence security boundaries', () => {
  it('does not expose an OpenAI API key through public env names', () => {
    const matches = walkFiles(repoRoot)
      .filter((file) => !file.includes(`${join('tests', 'openai-food-intelligence-security.test.ts')}`))
      .filter((file) => /\.(ts|tsx|js|jsx|swift|md|yaml|yml|env|example)$/.test(file))
      .filter((file) => /(?:process\.env\.NEXT_PUBLIC_OPENAI_API_KEY|NEXT_PUBLIC_OPENAI_API_KEY\s*=)/.test(readFileSync(file, 'utf8')));

    expect(matches).toEqual([]);
  });

  it('keeps OpenAI calls out of Swift/iOS sources', () => {
    const swiftMatches = walkFiles(join(repoRoot, 'ios'))
      .filter((file) => file.endsWith('.swift'))
      .filter((file) => /OpenAI|OPENAI_API_KEY|api\.openai\.com/i.test(readFileSync(file, 'utf8')));

    expect(swiftMatches).toEqual([]);
  });
});
