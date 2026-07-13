import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getFoodPipelineEnvironmentStatus,
  getOpenAIMealModel,
  getServerOpenAIApiKey,
  isMockMealParserAllowed,
} from '@/lib/ai/runtimeConfig';
import { createFoodPipelineTrace, finishFoodPipelineTrace, recordOpenAIIntent, recordProviderAttempt } from '@/lib/ai/foodPipelineTrace';
import { parseMealText } from '@/lib/ai/openai';
import { commercialDatabaseProvider } from '@/lib/nutrition/providers/commercialDatabase';
import { fatSecretProvider } from '@/lib/nutrition/providers/fatsecret';
import { usdaProvider } from '@/lib/nutrition/providers/usda';

describe('food pipeline runtime policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('treats empty and whitespace-only credentials as missing', () => {
    const status = getFoodPipelineEnvironmentStatus({
      NODE_ENV: 'production',
      OPENAI_API_KEY: '   ',
      OPENAI_MEAL_MODEL: '  ',
      USDA_FDC_API_KEY: '',
      FDC_API_KEY: '  ',
      NUTRITIONIX_APP_ID: '\t',
      NUTRITIONIX_API_KEY: undefined,
      FATSECRET_CLIENT_ID: ' ',
      FATSECRET_CLIENT_SECRET: undefined,
    });

    expect(status.openaiApiKey).toEqual({ present: false, nonEmpty: false });
    expect(status.openaiMealModel).toMatchObject({ present: false, configured: false, name: 'gpt-4.1-mini' });
    expect(status.usdaApiKey).toMatchObject({ present: false, nonEmpty: false, variable: null });
    expect(status.nutritionixAppId).toEqual({ present: false, nonEmpty: false });
    expect(status.nutritionixApiKey).toEqual({ present: false, nonEmpty: false });
    expect(status.fatSecretClientId).toEqual({ present: false, nonEmpty: false });
    expect(status.fatSecretClientSecret).toEqual({ present: false, nonEmpty: false });
  });

  it('detects configured values without returning any credential value', () => {
    const secret = 'test-secret-that-must-not-escape';
    const status = getFoodPipelineEnvironmentStatus({
      NODE_ENV: 'development',
      OPENAI_API_KEY: secret,
      OPENAI_MEAL_MODEL: 'gpt-test',
      USDA_FDC_API_KEY: 'usda-test',
      NUTRITIONIX_APP_ID: 'app-test',
      NUTRITIONIX_API_KEY: 'nutritionix-test',
      FATSECRET_CLIENT_ID: 'fatsecret-client-test',
      FATSECRET_CLIENT_SECRET: 'fatsecret-secret-test',
    });

    expect(status.openaiApiKey).toEqual({ present: true, nonEmpty: true });
    expect(status.openaiMealModel).toMatchObject({ present: true, configured: true, name: 'gpt-test' });
    expect(status.usdaApiKey).toMatchObject({ present: true, nonEmpty: true, variable: 'USDA_FDC_API_KEY' });
    expect(JSON.stringify(status)).not.toContain(secret);
    expect(JSON.stringify(status)).not.toContain('usda-test');
    expect(JSON.stringify(status)).not.toContain('fatsecret-secret-test');
    expect(status.fatSecretClientId).toEqual({ present: true, nonEmpty: true });
    expect(status.fatSecretClientSecret).toEqual({ present: true, nonEmpty: true });
  });

  it('uses explicit mock policy only outside production', () => {
    expect(isMockMealParserAllowed({ NODE_ENV: 'production', ALLOW_MOCK_MEAL_PARSER: 'true' })).toBe(false);
    expect(isMockMealParserAllowed({ NODE_ENV: 'test', ALLOW_MOCK_MEAL_PARSER: 'true' })).toBe(true);
    expect(isMockMealParserAllowed({ NODE_ENV: 'development', ALLOW_MOCK_MEAL_PARSER: 'false' })).toBe(false);
  });

  it('reads the model and API key dynamically from the supplied environment', () => {
    expect(getOpenAIMealModel({ OPENAI_MEAL_MODEL: 'gpt-dynamic' })).toMatchObject({ name: 'gpt-dynamic', configured: true });
    expect(getOpenAIMealModel({})).toMatchObject({ name: 'gpt-4.1-mini', configured: false });
    expect(getServerOpenAIApiKey({ OPENAI_API_KEY: '  key  ' })).toBe('key');
    expect(getServerOpenAIApiKey({ OPENAI_API_KEY: ' ' })).toBeNull();
  });

  it('returns recoverable clarification instead of a production mock when AI is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('ALLOW_MOCK_MEAL_PARSER', 'false');

    const response = await parseMealText('an unfamiliar casserole surprise', 'dinner');

    expect(response.needs_clarification).toBe(true);
    expect(response.items).toEqual([]);
    expect(JSON.stringify(response)).not.toContain('520');
  });
});

describe('nutrition provider availability', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports USDA as not configured without using DEMO_KEY', async () => {
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    expect(usdaProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'usda_not_configured' });
    const result = await usdaProvider.lookup({
      text: 'banana',
      mealType: 'snack',
      normalizedQuery: {
        rawText: 'banana', normalizedText: 'banana', searchText: 'banana', matchedQuery: 'banana', quantity: 1, quantityUnit: null, unitHint: null, brandHint: null,
      },
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps Nutritionix optional when credentials are absent or partial', async () => {
    vi.stubEnv('NUTRITIONIX_APP_ID', '');
    vi.stubEnv('NUTRITIONIX_API_KEY', '');
    expect(commercialDatabaseProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'nutritionix_not_configured' });
    vi.stubEnv('NUTRITIONIX_APP_ID', 'app');
    expect(commercialDatabaseProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'nutritionix_not_configured' });
  });

  it('keeps FatSecret optional when credentials are absent or partial', () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', '');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', '');
    expect(fatSecretProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'fatsecret_not_configured' });
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client');
    expect(fatSecretProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'fatsecret_not_configured' });
  });
});

describe('food pipeline trace', () => {
  it('records sanitized AI and provider outcomes without meal text', () => {
    const trace = createFoodPipelineTrace({ requestId: 'test-request' });
    recordOpenAIIntent(trace, { succeeded: false, model: 'gpt-test', failureReason: 'timeout', durationMs: 12 });
    recordProviderAttempt(trace, { provider: 'usda-fdc', configured: false, succeeded: false, outcome: 'not_configured', durationMs: 0 });
    trace.usedAiEstimate = true;
    finishFoodPipelineTrace(trace, { clarificationRequired: true });

    expect(trace).toMatchObject({
      requestId: 'test-request',
      openaiIntent: { attempted: true, succeeded: false, failureReason: 'timeout' },
      selectedProvider: null,
      usedAiEstimate: true,
      usedMock: false,
      clarificationRequired: true,
    });
    expect(JSON.stringify(trace)).not.toContain('meal text');
  });
});
