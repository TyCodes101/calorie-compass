#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_PRODUCTION_URL = 'https://calorie-compass-chi.vercel.app';

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    args.set(key, value);
  }
  return args;
}

async function readIosBackendURL(repoRoot) {
  const appConfigPath = path.join(repoRoot, 'ios', 'CalorieCompass', 'AppConfig.swift');
  try {
    const source = await readFile(appConfigPath, 'utf8');
    const match = source.match(/defaultBackendBaseURLString\s*=\s*"([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeCommit(value) {
  return value?.trim().toLowerCase() || null;
}

function commitMatches(actual, expected) {
  const normalizedActual = normalizeCommit(actual);
  const normalizedExpected = normalizeCommit(expected);
  if (!normalizedActual || !normalizedExpected) return false;
  return normalizedActual === normalizedExpected || normalizedActual.startsWith(normalizedExpected) || normalizedExpected.startsWith(normalizedActual);
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedCommit = args.get('expected-commit') ?? process.env.EXPECTED_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
const iosBackendURL = await readIosBackendURL(repoRoot);
const backendURL = (args.get('url') ?? process.env.BACKEND_URL ?? iosBackendURL ?? DEFAULT_PRODUCTION_URL).replace(/\/$/, '');
const versionURL = `${backendURL}/api/version`;

console.log(`iOS backend URL: ${iosBackendURL ?? 'not found; using default'}`);
console.log(`Checking backend: ${versionURL}`);
if (expectedCommit) {
  console.log(`Expected commit: ${expectedCommit}`);
} else {
  console.log('Expected commit: not provided; pass --expected-commit <sha> to enforce a match');
}

let payload;
try {
  const response = await fetch(versionURL, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  payload = await response.json();
} catch (error) {
  console.error(`Failed to fetch backend version: ${error.message}`);
  process.exit(1);
}

const actualCommit = payload?.git?.commit ?? payload?.commit ?? null;
console.log(`Backend app: ${payload?.app ?? 'unknown'}`);
console.log(`Backend environment: ${payload?.environment ?? 'unknown'}`);
console.log(`Backend provider: ${payload?.provider ?? 'unknown'}`);
console.log(`Backend branch/ref: ${payload?.git?.branch ?? 'unknown'}`);
console.log(`Backend commit: ${actualCommit ?? 'unknown'}`);
console.log(`Deployment URL: ${payload?.deployment?.url ?? 'unknown'}`);

if (expectedCommit && !commitMatches(actualCommit, expectedCommit)) {
  console.error(`Production backend commit mismatch. Expected ${expectedCommit}, got ${actualCommit ?? 'unknown'}.`);
  process.exit(1);
}

if (expectedCommit) {
  console.log('Production backend commit matches expected commit.');
} else {
  console.log('Version endpoint is reachable. No expected commit was enforced.');
}
