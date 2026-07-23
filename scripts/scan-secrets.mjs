import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !/\.(?:png|jpg|jpeg|gif|pdf|xcassets)$/i.test(file));

const forbidden = [
  { label: 'OpenAI-style secret', pattern: /\bsk-(?:proj|live|test)-[A-Za-z0-9_-]{12,}/ },
  { label: 'Stripe live secret', pattern: /\bsk_live_[A-Za-z0-9]{12,}/ },
  { label: 'Calorie API secret assignment', pattern: /^[ \t]*CALORIE_API_KEY[ \t]*=[ \t]*(?!your_|example|<|\$)[^\s#]{12,}/m },
  { label: 'FatSecret secret assignment', pattern: /^[ \t]*FATSECRET_CLIENT_SECRET[ \t]*=[ \t]*(?!your_|example|<|\$)[^\s#]{12,}/m },
];

const findings = [];
for (const file of trackedFiles) {
  let contents;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const rule of forbidden) {
    if (rule.pattern.test(contents)) findings.push(`${file}: ${rule.label}`);
  }
}

if (findings.length) {
  process.stderr.write(`Secret scan failed:\n${findings.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Secret scan passed across ${trackedFiles.length} tracked text files.\n`);
