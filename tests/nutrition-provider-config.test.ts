import { describe, expect, it } from 'vitest';

import {
  CALORIE_API_DEFAULT_BASE_URL,
  fatSecretScopeSupports,
  getCalorieApiConfiguration,
  getFatSecretConfiguration,
} from '@/lib/nutrition/providers/providerConfig';

describe('nutrition provider configuration', () => {
  it('treats missing and whitespace-only Calorie API keys as disabled provider configuration', () => {
    expect(getCalorieApiConfiguration({})).toMatchObject({ configured: false, reason: 'missing_key', apiKey: null });
    expect(getCalorieApiConfiguration({ CALORIE_API_KEY: '   ' })).toMatchObject({ configured: false, reason: 'missing_key', apiKey: null });
  });

  it('enables a present key without exposing it through a public variable', () => {
    const config = getCalorieApiConfiguration({ CALORIE_API_KEY: '  secret-value  ' });
    expect(config).toMatchObject({ configured: true, enabled: true, apiKey: 'secret-value', baseUrl: CALORIE_API_DEFAULT_BASE_URL });
  });

  it('parses the enabled flag strictly and rejects an untrusted or insecure base URL', () => {
    expect(getCalorieApiConfiguration({ CALORIE_API_KEY: 'key', CALORIE_API_ENABLED: 'maybe' })).toMatchObject({
      configured: false,
      enabled: false,
      reason: 'invalid_enabled_flag',
    });
    expect(getCalorieApiConfiguration({ CALORIE_API_KEY: 'key', CALORIE_API_BASE_URL: 'http://calorieapiadmin.com/api/v1' })).toMatchObject({
      configured: false,
      reason: 'untrusted_base_url',
    });
    expect(getCalorieApiConfiguration({ CALORIE_API_KEY: 'key', CALORIE_API_BASE_URL: 'https://evil.example/api/v1' })).toMatchObject({
      configured: false,
      reason: 'untrusted_base_url',
    });
  });

  it('keeps FatSecret disabled for partial credentials and validates scopes', () => {
    expect(getFatSecretConfiguration({ FATSECRET_CLIENT_ID: 'id' })).toMatchObject({ configured: false, reason: 'missing_credentials' });
    expect(getFatSecretConfiguration({ FATSECRET_CLIENT_ID: 'id', FATSECRET_CLIENT_SECRET: 'secret', FATSECRET_SCOPE: 'unknown' })).toMatchObject({
      configured: false,
      reason: 'invalid_scope',
    });
    expect(getFatSecretConfiguration({ FATSECRET_CLIENT_ID: 'id', FATSECRET_CLIENT_SECRET: 'secret' })).toMatchObject({
      configured: true,
      scope: 'premier',
    });
  });

  it('models FatSecret search and barcode capabilities independently', () => {
    expect(fatSecretScopeSupports('basic', 'search')).toBe(false);
    expect(fatSecretScopeSupports('premier', 'search')).toBe(true);
    expect(fatSecretScopeSupports('basic', 'barcode')).toBe(false);
    expect(fatSecretScopeSupports('basic barcode', 'barcode')).toBe(true);
  });
});
