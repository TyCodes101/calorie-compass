type RuntimeEnv = Record<string, string | undefined>;

export const CALORIE_API_DEFAULT_BASE_URL = 'https://calorieapiadmin.com/api/v1';
export const FATSECRET_API_BASE_URL = 'https://platform.fatsecret.com/rest';
export const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

const CALORIE_API_ALLOWED_ORIGIN = 'https://calorieapiadmin.com';
const FATSECRET_ALLOWED_SCOPES = new Set([
  'basic',
  'premier',
  'barcode',
  'localization',
]);

function readNonEmpty(env: RuntimeEnv, name: string) {
  return env[name]?.trim() || null;
}

function parseEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return { enabled: true, valid: true };
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return { enabled: true, valid: true };
  if (['0', 'false', 'no', 'off'].includes(normalized)) return { enabled: false, valid: true };
  return { enabled: false, valid: false };
}

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value?.trim());
  if (!Number.isFinite(parsed) || parsed < 500 || parsed > 10_000) return fallback;
  return Math.round(parsed);
}

function normalizeCalorieApiBaseUrl(value: string | null) {
  const candidate = value ?? CALORIE_API_DEFAULT_BASE_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.origin !== CALORIE_API_ALLOWED_ORIGIN) return null;
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '/api/v1') return null;
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function normalizeFatSecretScope(value: string | null) {
  const scopes = (value ?? 'premier')
    .split(/\s+/)
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);

  if (!scopes.length || scopes.some((scope) => !FATSECRET_ALLOWED_SCOPES.has(scope))) {
    return null;
  }

  return [...new Set(scopes)].join(' ');
}

export type CalorieApiConfiguration = {
  configured: boolean;
  enabled: boolean;
  reason?: 'disabled' | 'invalid_enabled_flag' | 'missing_key' | 'untrusted_base_url';
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
};

export function getCalorieApiConfiguration(env: RuntimeEnv = process.env): CalorieApiConfiguration {
  const enabled = parseEnabled(env.CALORIE_API_ENABLED);
  const apiKey = readNonEmpty(env, 'CALORIE_API_KEY');
  const baseUrl = normalizeCalorieApiBaseUrl(readNonEmpty(env, 'CALORIE_API_BASE_URL'));

  if (!enabled.valid) {
    return {
      configured: false,
      enabled: false,
      reason: 'invalid_enabled_flag',
      apiKey: null,
      baseUrl: CALORIE_API_DEFAULT_BASE_URL,
      timeoutMs: parseTimeout(env.CALORIE_API_TIMEOUT_MS, 3_500),
    };
  }

  if (!enabled.enabled) {
    return {
      configured: false,
      enabled: false,
      reason: 'disabled',
      apiKey: null,
      baseUrl: baseUrl ?? CALORIE_API_DEFAULT_BASE_URL,
      timeoutMs: parseTimeout(env.CALORIE_API_TIMEOUT_MS, 3_500),
    };
  }

  if (!baseUrl) {
    return {
      configured: false,
      enabled: true,
      reason: 'untrusted_base_url',
      apiKey: null,
      baseUrl: CALORIE_API_DEFAULT_BASE_URL,
      timeoutMs: parseTimeout(env.CALORIE_API_TIMEOUT_MS, 3_500),
    };
  }

  return {
    configured: Boolean(apiKey),
    enabled: true,
    reason: apiKey ? undefined : 'missing_key',
    apiKey,
    baseUrl,
    timeoutMs: parseTimeout(env.CALORIE_API_TIMEOUT_MS, 3_500),
  };
}

export type FatSecretConfiguration = {
  configured: boolean;
  enabled: boolean;
  reason?: 'disabled' | 'invalid_enabled_flag' | 'missing_credentials' | 'invalid_scope';
  clientId: string | null;
  clientSecret: string | null;
  scope: string;
  region: string;
  timeoutMs: number;
};

export function getFatSecretConfiguration(env: RuntimeEnv = process.env): FatSecretConfiguration {
  const enabled = parseEnabled(env.FATSECRET_ENABLED);
  const clientId = readNonEmpty(env, 'FATSECRET_CLIENT_ID');
  const clientSecret = readNonEmpty(env, 'FATSECRET_CLIENT_SECRET');
  const scope = normalizeFatSecretScope(readNonEmpty(env, 'FATSECRET_SCOPE'));
  const region = readNonEmpty(env, 'FATSECRET_REGION')?.toUpperCase() ?? 'US';
  const timeoutMs = parseTimeout(env.FATSECRET_TIMEOUT_MS, 3_500);

  if (!enabled.valid) {
    return {
      configured: false,
      enabled: false,
      reason: 'invalid_enabled_flag',
      clientId: null,
      clientSecret: null,
      scope: scope ?? 'premier',
      region,
      timeoutMs,
    };
  }

  if (!enabled.enabled) {
    return {
      configured: false,
      enabled: false,
      reason: 'disabled',
      clientId: null,
      clientSecret: null,
      scope: scope ?? 'premier',
      region,
      timeoutMs,
    };
  }

  if (!scope) {
    return {
      configured: false,
      enabled: true,
      reason: 'invalid_scope',
      clientId: null,
      clientSecret: null,
      scope: 'premier',
      region,
      timeoutMs,
    };
  }

  return {
    configured: Boolean(clientId && clientSecret),
    enabled: true,
    reason: clientId && clientSecret ? undefined : 'missing_credentials',
    clientId,
    clientSecret,
    scope,
    region,
    timeoutMs,
  };
}

export function fatSecretScopeSupports(scope: string, capability: 'search' | 'barcode') {
  const scopes = new Set(scope.split(/\s+/).filter(Boolean));
  return capability === 'barcode' ? scopes.has('barcode') : scopes.has('premier');
}
