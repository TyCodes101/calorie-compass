const baseUrl = process.env.PREVIEW_BASE_URL?.trim().replace(/\/$/, '');
if (!baseUrl) {
  process.stdout.write('PREVIEW_BASE_URL is not configured; preview smoke checks were skipped.\n');
  process.exit(0);
}

const queries = ['banana', 'KitKat', '2 eggs', 'hot cheeots', 'McDouble no cheese'];
const failures = [];

for (const query of queries) {
  try {
    const response = await fetch(`${baseUrl}/api/food-search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json', 'X-Calorie-Compass-Client': 'release-smoke' },
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json();
    const valid = response.ok
      && typeof payload?.normalizedQuery === 'string'
      && Array.isArray(payload?.results)
      && payload.results.every((result) => (
        typeof result?.name === 'string'
        && Number.isFinite(result?.calories)
        && typeof result?.sourceLabel === 'string'
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

process.stdout.write(`Preview Food Intelligence smoke passed for ${queries.length} representative queries.\n`);
