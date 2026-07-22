const baseUrl = process.env.PREVIEW_BASE_URL?.trim().replace(/\/$/, '');
if (!baseUrl) {
  process.stdout.write('PREVIEW_BASE_URL is not configured; preview smoke checks were skipped.\n');
  process.exit(0);
}

const scenarios = [
  { query: 'banana', identity: /banana/i, minimumResults: 1 },
  { query: 'KitKat', identity: /kit\s*kat/i, minimumResults: 1 },
  { query: '2 eggs', identity: /eggs?/i, minimumResults: 1, quantity: 2 },
  { query: 'hot cheeots', identity: /cheetos/i, minimumResults: 1 },
  { query: 'McDouble no cheese', identity: /mcdouble/i, minimumResults: 1, modifier: /no cheese/i },
];
const failures = [];
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

function requestHeaders() {
  return {
    Accept: 'application/json',
    'X-Calorie-Compass-Client': 'release-smoke',
    ...(protectionBypass ? {
      'x-vercel-protection-bypass': protectionBypass,
    } : {}),
  };
}

for (const scenario of scenarios) {
  const { query } = scenario;
  try {
    const response = await fetch(`${baseUrl}/api/food-search?q=${encodeURIComponent(query)}`, {
      headers: requestHeaders(),
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 401 && !protectionBypass) {
      failures.push(`${query}: preview is protected; configure the VERCEL_AUTOMATION_BYPASS_SECRET GitHub Actions secret`);
      continue;
    }
    const payload = await response.json();
    const first = payload?.results?.[0];
    const items = Array.isArray(first?.items) ? first.items : [];
    const identityMatches = payload?.results?.some((result) => scenario.identity.test(String(result?.name ?? ''))) ?? false;
    const quantityMatches = scenario.quantity === undefined
      || items.some((item) => Number(item?.quantity) === scenario.quantity);
    const modifierMatches = scenario.modifier === undefined
      || items.some((item) => (item?.requested_modifiers ?? []).some((modifier) => scenario.modifier.test(String(modifier))));
    const valid = response.ok
      && typeof payload?.normalizedQuery === 'string'
      && Array.isArray(payload?.results)
      && payload.results.length >= scenario.minimumResults
      && identityMatches
      && quantityMatches
      && modifierMatches
      && payload.results.every((result) => (
        typeof result?.name === 'string'
        && Number.isFinite(result?.calories)
        && typeof result?.sourceLabel === 'string'
        && result.sourceLabel.length > 0
        && Array.isArray(result?.items)
      ));
    if (!valid) failures.push(`${query}: invalid ${response.status} response`);
  } catch (error) {
    failures.push(`${query}: ${error instanceof Error ? error.name : 'request_failed'}`);
  }
}

if (failures.length) {
  process.stderr.write(`Preview Food Intelligence smoke failed:\n${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Preview Food Intelligence smoke passed for ${scenarios.length} representative queries.\n`);
