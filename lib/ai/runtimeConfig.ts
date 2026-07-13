type RuntimeEnv = Record<string, string | undefined>;

const DEFAULT_MEAL_MODEL = 'gpt-4.1-mini';

function readNonEmpty(env: RuntimeEnv, key: string) {
  const value = env[key]?.trim();
  return value || null;
}

function parseBoolean(value: string | undefined) {
  return /^(?:1|true|yes|on)$/i.test(value?.trim() ?? '');
}

export function getServerOpenAIApiKey(env: RuntimeEnv = process.env) {
  return readNonEmpty(env, 'OPENAI_API_KEY');
}

export function getOpenAIMealModel(env: RuntimeEnv = process.env) {
  const configuredModel = readNonEmpty(env, 'OPENAI_MEAL_MODEL');
  return {
    name: configuredModel ?? DEFAULT_MEAL_MODEL,
    configured: Boolean(configuredModel),
  };
}

export function getOpenAIFoodIntelligenceTimeoutMs(env: RuntimeEnv = process.env) {
  const raw = Number(readNonEmpty(env, 'OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS'));
  return Number.isFinite(raw) && raw > 0 ? raw : 4500;
}

export function isMockMealParserAllowed(env: RuntimeEnv = process.env) {
  return env.NODE_ENV !== 'production' && parseBoolean(env.ALLOW_MOCK_MEAL_PARSER);
}

export type FoodPipelineEnvironmentStatus = {
  nodeEnv: string;
  openaiApiKey: { present: boolean; nonEmpty: boolean };
  openaiMealModel: { present: boolean; configured: boolean; name: string };
  usdaApiKey: { present: boolean; nonEmpty: boolean; variable: 'USDA_FDC_API_KEY' | 'FDC_API_KEY' | null };
  nutritionixAppId: { present: boolean; nonEmpty: boolean };
  nutritionixApiKey: { present: boolean; nonEmpty: boolean };
  fatSecretClientId: { present: boolean; nonEmpty: boolean };
  fatSecretClientSecret: { present: boolean; nonEmpty: boolean };
  allowMockMealParser: boolean;
  foodPipelineDebug: boolean;
};

export function getFoodPipelineEnvironmentStatus(env: RuntimeEnv = process.env): FoodPipelineEnvironmentStatus {
  const openaiApiKey = readNonEmpty(env, 'OPENAI_API_KEY');
  const configuredModel = readNonEmpty(env, 'OPENAI_MEAL_MODEL');
  const usdaApiKey = readNonEmpty(env, 'USDA_FDC_API_KEY');
  const compatibilityUsdaApiKey = readNonEmpty(env, 'FDC_API_KEY');
  const nutritionixAppId = readNonEmpty(env, 'NUTRITIONIX_APP_ID');
  const nutritionixApiKey = readNonEmpty(env, 'NUTRITIONIX_API_KEY');
  const fatSecretClientId = readNonEmpty(env, 'FATSECRET_CLIENT_ID');
  const fatSecretClientSecret = readNonEmpty(env, 'FATSECRET_CLIENT_SECRET');

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    openaiApiKey: { present: openaiApiKey !== null, nonEmpty: openaiApiKey !== null },
    openaiMealModel: {
      present: configuredModel !== null,
      configured: configuredModel !== null,
      name: configuredModel ?? DEFAULT_MEAL_MODEL,
    },
    usdaApiKey: {
      present: usdaApiKey !== null || compatibilityUsdaApiKey !== null,
      nonEmpty: usdaApiKey !== null || compatibilityUsdaApiKey !== null,
      variable: usdaApiKey !== null ? 'USDA_FDC_API_KEY' : compatibilityUsdaApiKey !== null ? 'FDC_API_KEY' : null,
    },
    nutritionixAppId: { present: nutritionixAppId !== null, nonEmpty: nutritionixAppId !== null },
    nutritionixApiKey: { present: nutritionixApiKey !== null, nonEmpty: nutritionixApiKey !== null },
    fatSecretClientId: { present: fatSecretClientId !== null, nonEmpty: fatSecretClientId !== null },
    fatSecretClientSecret: { present: fatSecretClientSecret !== null, nonEmpty: fatSecretClientSecret !== null },
    allowMockMealParser: isMockMealParserAllowed(env),
    foodPipelineDebug: parseBoolean(env.FOOD_PIPELINE_DEBUG),
  };
}

export { DEFAULT_MEAL_MODEL };
