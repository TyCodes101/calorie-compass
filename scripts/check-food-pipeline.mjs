import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const live = process.argv.includes('--live');
const envPath = join(root, '.env.local');

function loadLocalEnv() {
  if (!existsSync(envPath)) return false;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }

  return true;
}

function nonEmpty(name) {
  return Boolean(process.env[name]?.trim());
}

function printStatus(name, present) {
  console.log(`${name}: ${present ? 'present' : 'missing'}`);
}

function countCandidates(payload, paths) {
  for (const path of paths) {
    let value = payload;
    for (const segment of path) value = value?.[segment];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return 1;
  }
  return 0;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function liveSummary(provider, response, startedAt, candidateCount) {
  console.log(`${provider} live search: HTTP ${response.status}; latencyMs=${Date.now() - startedAt}; candidateCount=${candidateCount}`);
}

const loaded = loadLocalEnv();
const model = process.env.OPENAI_MEAL_MODEL?.trim() || 'gpt-4.1-mini';
const mockEnabled = process.env.NODE_ENV !== 'production' && /^(?:1|true|yes|on)$/i.test(process.env.ALLOW_MOCK_MEAL_PARSER?.trim() ?? '');

console.log('MacroMesh food pipeline check');
console.log(`.env.local: ${loaded ? 'loaded from repository root' : 'not found'}`);
printStatus('OPENAI_API_KEY', nonEmpty('OPENAI_API_KEY'));
console.log(`OPENAI_MEAL_MODEL: ${model}${process.env.OPENAI_MEAL_MODEL?.trim() ? ' (configured)' : ' (default)'}`);
printStatus('USDA_FDC_API_KEY', nonEmpty('USDA_FDC_API_KEY'));
printStatus('FDC_API_KEY', nonEmpty('FDC_API_KEY'));
printStatus('NUTRITIONIX_APP_ID', nonEmpty('NUTRITIONIX_APP_ID'));
printStatus('NUTRITIONIX_API_KEY', nonEmpty('NUTRITIONIX_API_KEY'));
printStatus('FATSECRET_CLIENT_ID', nonEmpty('FATSECRET_CLIENT_ID'));
printStatus('FATSECRET_CLIENT_SECRET', nonEmpty('FATSECRET_CLIENT_SECRET'));
printStatus('CALORIE_API_KEY', nonEmpty('CALORIE_API_KEY'));
console.log(`OPEN_FOOD_FACTS_ENABLED: ${/^(?:0|false|no|off)$/i.test(process.env.OPEN_FOOD_FACTS_ENABLED?.trim() ?? '') ? 'disabled' : 'enabled'}`);
printStatus('UPC_DATABASE_API_KEY', nonEmpty('UPC_DATABASE_API_KEY'));
console.log(`UPC_DATABASE_ENABLED: ${/^(?:1|true|yes|on)$/i.test(process.env.UPC_DATABASE_ENABLED?.trim() ?? '') ? 'enabled' : 'disabled'}`);
console.log(`ALLOW_MOCK_MEAL_PARSER: ${mockEnabled ? 'enabled (non-production only)' : 'disabled'}`);
console.log(`FOOD_PIPELINE_DEBUG: ${/^(?:1|true|yes|on)$/i.test(process.env.FOOD_PIPELINE_DEBUG?.trim() ?? '') ? 'enabled' : 'disabled'}`);

if (!live) {
  console.log('Live provider calls: skipped (use --live explicitly).');
  process.exit(0);
}

const failures = [];
if (nonEmpty('OPENAI_API_KEY')) {
  try {
    const startedAt = Date.now();
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) failures.push(`OpenAI health check returned HTTP ${response.status}`);
    else console.log(`OpenAI authentication check: HTTP ${response.status}; latencyMs=${Date.now() - startedAt}`);
  } catch {
    failures.push('OpenAI health check failed');
  }
} else {
  console.log('OpenAI live check: skipped because the key is missing');
}

const usdaKey = process.env.USDA_FDC_API_KEY?.trim() || process.env.FDC_API_KEY?.trim();
if (usdaKey) {
  try {
    const startedAt = Date.now();
    const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=banana&pageSize=1`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) failures.push(`USDA health check returned HTTP ${response.status}`);
    else {
      const payload = await safeJson(response);
      liveSummary('USDA', response, startedAt, countCandidates(payload, [['foods']]));
    }
  } catch {
    failures.push('USDA health check failed');
  }
} else {
  console.log('USDA live check: skipped because no USDA key is configured');
}

const fatSecretClientId = process.env.FATSECRET_CLIENT_ID?.trim();
const fatSecretClientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim();
if (fatSecretClientId && fatSecretClientSecret) {
  try {
    const authorization = Buffer.from(`${fatSecretClientId}:${fatSecretClientSecret}`).toString('base64');
    const requestToken = (scope) => fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }).toString(),
      signal: AbortSignal.timeout(8_000),
    });
    const requestedScope = process.env.FATSECRET_SCOPE?.trim() || 'basic';
    let effectiveScope = requestedScope;
    let response = await requestToken(requestedScope);
    if ([400, 403].includes(response.status) && !requestedScope.split(/\s+/).includes('basic')) {
      effectiveScope = 'basic';
      response = await requestToken('basic');
    }
    if (!response.ok) {
      failures.push(`FatSecret authentication check returned HTTP ${response.status}`);
    } else {
      const tokenPayload = await safeJson(response);
      const accessToken = typeof tokenPayload?.access_token === 'string' ? tokenPayload.access_token : null;
      if (!accessToken) {
        failures.push('FatSecret authentication returned an invalid payload');
      } else {
        const premier = effectiveScope.split(/\s+/).includes('premier');
        const searchUrl = new URL(`https://platform.fatsecret.com/rest/foods/search/${premier ? 'v5' : 'v1'}`);
        searchUrl.searchParams.set('search_expression', 'banana');
        searchUrl.searchParams.set('max_results', '1');
        searchUrl.searchParams.set('format', 'json');
        if (premier) searchUrl.searchParams.set('region', process.env.FATSECRET_REGION?.trim() || 'US');
        const startedAt = Date.now();
        const searchResponse = await fetch(searchUrl, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (!searchResponse.ok) {
          failures.push(`FatSecret search check returned HTTP ${searchResponse.status}`);
        } else {
          const payload = await safeJson(searchResponse);
          liveSummary('FatSecret', searchResponse, startedAt, countCandidates(payload, [
            ['foods_search', 'results', 'food'],
            ['foods', 'food'],
          ]));
        }
      }
    }
  } catch {
    failures.push('FatSecret health check failed');
  }
} else {
  console.log('FatSecret live check: skipped because credentials are missing');
}

const calorieApiKey = process.env.CALORIE_API_KEY?.trim();
if (calorieApiKey) {
  try {
    const startedAt = Date.now();
    const response = await fetch('https://calorieapiadmin.com/api/v1/search/foods?q=banana&limit=1', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': calorieApiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) failures.push(`Calorie API health check returned HTTP ${response.status}`);
    else {
      const payload = await safeJson(response);
      liveSummary('Calorie API', response, startedAt, countCandidates(payload, [['foods'], ['results'], ['data']]));
    }
  } catch {
    failures.push('Calorie API health check failed');
  }
} else {
  console.log('Calorie API live check: skipped because the key is missing');
}

if (!/^(?:0|false|no|off)$/i.test(process.env.OPEN_FOOD_FACTS_ENABLED?.trim() ?? '')) {
  try {
    const contact = process.env.OPEN_FOOD_FACTS_CONTACT?.trim() || 'https://github.com/TyCodes101/calorie-compass';
    const startedAt = Date.now();
    const response = await fetch('https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&search_terms=kit%20kat&page_size=5', {
      headers: { Accept: 'application/json', 'User-Agent': `MacroMesh/1.0 (${contact.replace(/[\r\n]/g, '')})` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) failures.push(`Open Food Facts health check returned HTTP ${response.status}`);
    else {
      const payload = await safeJson(response);
      liveSummary('Open Food Facts', response, startedAt, countCandidates(payload, [['products']]));
    }
  } catch {
    failures.push('Open Food Facts health check failed');
  }
} else {
  console.log('Open Food Facts live check: skipped because the provider is disabled');
}

const upcDatabaseEnabled = /^(?:1|true|yes|on)$/i.test(process.env.UPC_DATABASE_ENABLED?.trim() ?? '');
if (upcDatabaseEnabled && nonEmpty('UPC_DATABASE_API_KEY')) {
  try {
    const response = await fetch('https://api.upcdatabase.org/product/012345678905', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.UPC_DATABASE_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (![200, 404].includes(response.status)) failures.push(`UPC Database health check returned HTTP ${response.status}`);
    else console.log('UPC Database live check: reachable');
  } catch {
    failures.push('UPC Database health check failed');
  }
} else {
  console.log('UPC Database live check: skipped because the provider is disabled or the key is missing');
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
