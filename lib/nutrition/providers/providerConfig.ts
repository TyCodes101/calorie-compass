type RuntimeEnv = Record<string, string | undefined>;

export const CALORIE_API_DEFAULT_BASE_URL = 'https://calorieapiadmin.com/api/v1';
export const FATSECRET_API_BASE_URL = 'https://platform.fatsecret.com/rest';
export const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
export const OPEN_FOOD_FACTS_DEFAULT_BASE_URL = 'https://world.openfoodfacts.org';
export const UPC_DATABASE_API_BASE_URL = 'https://api.upcdatabase.org';

const OPEN_FOOD_FACTS_DEFAULT_CONTACT = 'https://github.com/TyCodes101/calorie-compass';

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

function parseEnabled(value: string | undefined, defaultValue = true) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return { enabled: defaultValue, valid: true };
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return { enabled: true, valid: true };
  if (['0', 'false', 'no', 'off'].includes(normalized)) return { enabled: false, valid: true };
  return { enabled: false, valid: false };
}

function normalizeExactHttpsOrigin(value: string | null, expectedOrigin: string) {
  const candidate = value ?? expectedOrigin;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.origin !== expectedOrigin) return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeHeaderContact(value: string | null) {
  const contact = value ?? OPEN_FOOD_FACTS_DEFAULT_CONTACT;
  if (!contact || contact.length > 180 || /[\r\n]/.test(contact)) return null;
  return contact;
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
  const scopes = (value ?? 'basic')
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
      scope: scope ?? 'basic',
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
      scope: scope ?? 'basic',
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
      scope: 'basic',
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
  return capability === 'barcode' ? scopes.has('barcode') : scopes.has('basic') || scopes.has('premier');
}

export type OpenFoodFactsConfiguration = {
  configured: boolean;
  enabled: boolean;
  reason?: 'disabled' | 'invalid_enabled_flag' | 'untrusted_base_url' | 'invalid_contact';
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
};

export function getOpenFoodFactsConfiguration(env: RuntimeEnv = process.env): OpenFoodFactsConfiguration {
  const enabled = parseEnabled(env.OPEN_FOOD_FACTS_ENABLED);
  const baseUrl = normalizeExactHttpsOrigin(readNonEmpty(env, 'OPEN_FOOD_FACTS_BASE_URL'), OPEN_FOOD_FACTS_DEFAULT_BASE_URL);
  const contact = normalizeHeaderContact(readNonEmpty(env, 'OPEN_FOOD_FACTS_CONTACT'));
  const timeoutMs = parseTimeout(env.OPEN_FOOD_FACTS_TIMEOUT_MS, 3_000);

  if (!enabled.valid) {
    return {
      configured: false,
      enabled: false,
      reason: 'invalid_enabled_flag',
      baseUrl: OPEN_FOOD_FACTS_DEFAULT_BASE_URL,
      userAgent: `MacroMesh/1.0 (${OPEN_FOOD_FACTS_DEFAULT_CONTACT})`,
      timeoutMs,
    };
  }
  if (!enabled.enabled) {
    return {
      configured: false,
      enabled: false,
      reason: 'disabled',
      baseUrl: baseUrl ?? OPEN_FOOD_FACTS_DEFAULT_BASE_URL,
      userAgent: `MacroMesh/1.0 (${contact ?? OPEN_FOOD_FACTS_DEFAULT_CONTACT})`,
      timeoutMs,
    };
  }
  if (!baseUrl) {
    return {
      configured: false,
      enabled: true,
      reason: 'untrusted_base_url',
      baseUrl: OPEN_FOOD_FACTS_DEFAULT_BASE_URL,
      userAgent: `MacroMesh/1.0 (${contact ?? OPEN_FOOD_FACTS_DEFAULT_CONTACT})`,
      timeoutMs,
    };
  }
  if (!contact) {
    return {
      configured: false,
      enabled: true,
      reason: 'invalid_contact',
      baseUrl,
      userAgent: `MacroMesh/1.0 (${OPEN_FOOD_FACTS_DEFAULT_CONTACT})`,
      timeoutMs,
    };
  }

  return {
    configured: true,
    enabled: true,
    baseUrl,
    userAgent: `MacroMesh/1.0 (${contact})`,
    timeoutMs,
  };
}

export type UpcDatabaseConfiguration = {
  configured: boolean;
  enabled: boolean;
  reason?: 'disabled' | 'invalid_enabled_flag' | 'missing_key';
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
};

export function getUpcDatabaseConfiguration(env: RuntimeEnv = process.env): UpcDatabaseConfiguration {
  const enabled = parseEnabled(env.UPC_DATABASE_ENABLED, false);
  const apiKey = readNonEmpty(env, 'UPC_DATABASE_API_KEY');
  const timeoutMs = parseTimeout(env.UPC_DATABASE_TIMEOUT_MS, 2_500);

  if (!enabled.valid) {
    return {
      configured: false,
      enabled: false,
      reason: 'invalid_enabled_flag',
      apiKey: null,
      baseUrl: UPC_DATABASE_API_BASE_URL,
      timeoutMs,
    };
  }
  if (!enabled.enabled) {
    return {
      configured: false,
      enabled: false,
      reason: 'disabled',
      apiKey: null,
      baseUrl: UPC_DATABASE_API_BASE_URL,
      timeoutMs,
    };
  }

  return {
    configured: Boolean(apiKey),
    enabled: true,
    reason: apiKey ? undefined : 'missing_key',
    apiKey,
    baseUrl: UPC_DATABASE_API_BASE_URL,
    timeoutMs,
  };
}
