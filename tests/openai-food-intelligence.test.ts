import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  foodIntelligenceResultSchema,
  mapFoodIntelligenceToMealAssistantDecision,
  runOpenAIFoodIntelligence,
} from '@/lib/ai/openaiFoodIntelligence';

function completion(content: unknown) {
  return {
    choices: [
      {
        message: {
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

function baconatorIntent() {
  return {
    action: 'create_pending_meal',
    confidence: 0.91,
    ambiguity: {
      isAmbiguous: false,
      reason: null,
      clarificationQuestion: null,
    },
    items: [
      {
        rawText: "Wendy's Baconnator",
        normalizedName: "Wendy's Baconator",
        brandOrRestaurant: "Wendy's",
        foodType: 'restaurant',
        quantity: {
          amount: 1,
          unit: 'sandwich',
          servingText: '1 sandwich',
        },
        modifiers: [],
        candidateQueries: ["Wendy's Baconator", 'Baconator sandwich'],
        expectedIdentity: {
          restaurant: "Wendy's",
          brand: null,
          canonicalItem: 'Baconator',
          mustNotMatch: ['spicy chicken sandwich', 'homestyle chicken sandwich'],
        },
        nutritionExpectation: {
          shouldBeZeroCalorieDrink: false,
          shouldScaleWithQuantity: false,
          shouldBeFootlong: false,
          shouldBeNoCheese: false,
          shouldBeEstimateOnly: false,
        },
      },
    ],
    userFacingMessage: 'I found the Wendy’s Baconator and will verify it before review.',
  };
}

describe('OpenAI food intelligence wrapper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns validated structured food intent for messy restaurant input', async () => {
    const createChatCompletion = vi.fn().mockResolvedValue(completion(baconatorIntent()));

    const result = await runOpenAIFoodIntelligence(
      {
        message: "log Wendy's Baconnator",
        state: {
          mealType: 'dinner',
          currentMealItems: [],
          pendingClarification: null,
          lastAssistantQuestion: null,
          userCorrections: [],
          saved: false,
          currentMealText: null,
          confidenceScore: 0.82,
        },
      },
      {
        apiKey: 'test-key',
        createChatCompletion,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]).toMatchObject({
        normalizedName: "Wendy's Baconator",
        brandOrRestaurant: "Wendy's",
        foodType: 'restaurant',
      });
      expect(foodIntelligenceResultSchema.parse(result.value)).toEqual(result.value);
    }
    expect(createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1-mini',
        response_format: expect.objectContaining({
          type: 'json_schema',
        }),
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('maps structured intent into existing meal assistant decisions without trusting nutrition', () => {
    const decision = mapFoodIntelligenceToMealAssistantDecision(baconatorIntent(), 'log Wendy baconnator');

    expect(decision).toMatchObject({
      intent: 'new_food_item',
      action: 'add_food',
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_mutate_pending_meal: true,
      confidence: 'high',
    });
    expect(decision.items[0]).toMatchObject({
      name: "Wendy's Baconator",
      brand: "Wendy's",
      quantity: 1,
      unit: 'sandwich',
      action: 'add',
    });
    expect(JSON.stringify(decision)).not.toMatch(/calories|is_trusted|source_type/i);
  });

  it('turns ambiguous low-confidence food into clarification instead of lookup', () => {
    const decision = mapFoodIntelligenceToMealAssistantDecision({
      action: 'ask_clarification',
      confidence: 0.32,
      ambiguity: {
        isAmbiguous: true,
        reason: 'Chicken sandwich could be restaurant or homemade.',
        clarificationQuestion: 'Which chicken sandwich was it?',
      },
      items: [],
      userFacingMessage: 'Which chicken sandwich was it?',
    }, 'chicken sandwich');

    expect(decision).toMatchObject({
      intent: 'unknown',
      action: 'unclear',
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: true,
      clarification_question: 'Which chicken sandwich was it?',
      confidence: 'low',
    });
  });

  it('falls back safely when the API key is missing', async () => {
    const createChatCompletion = vi.fn();

    const result = await runOpenAIFoodIntelligence(
      {
        message: 'Diet Coke',
        state: {
          mealType: 'snack',
          currentMealItems: [],
          pendingClarification: null,
          lastAssistantQuestion: null,
          userCorrections: [],
          saved: false,
          currentMealText: null,
          confidenceScore: 0.82,
        },
      },
      { apiKey: null, createChatCompletion },
    );

    expect(result).toEqual({ ok: false, reason: 'missing_api_key' });
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_json', 'not-json'],
    ['schema_invalid', { action: 'create_pending_meal', confidence: 2, ambiguity: { isAmbiguous: false }, items: [] }],
    ['unsafe_schema', { ...baconatorIntent(), items: [{ ...baconatorIntent().items[0], calories: 960, source_type: 'OFFICIAL_RESTAURANT' }] }],
    ['empty_output', ''],
  ])('returns %s instead of unchecked model output', async (reason, content) => {
    const result = await runOpenAIFoodIntelligence(
      {
        message: 'test',
        state: {
          mealType: 'snack',
          currentMealItems: [],
          pendingClarification: null,
          lastAssistantQuestion: null,
          userCorrections: [],
          saved: false,
          currentMealText: null,
          confidenceScore: 0.82,
        },
      },
      {
        apiKey: 'test-key',
        createChatCompletion: vi.fn().mockResolvedValue(completion(content)),
      },
    );

    expect(result).toMatchObject({ ok: false, reason });
  });

  it('classifies rate limits and timeouts as safe fallback reasons', async () => {
    const rateLimited = await runOpenAIFoodIntelligence(
      {
        message: 'Diet Coke',
        state: {
          mealType: 'snack',
          currentMealItems: [],
          pendingClarification: null,
          lastAssistantQuestion: null,
          userCorrections: [],
          saved: false,
          currentMealText: null,
          confidenceScore: 0.82,
        },
      },
      {
        apiKey: 'test-key',
        createChatCompletion: vi.fn().mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 })),
      },
    );

    const timedOut = await runOpenAIFoodIntelligence(
      {
        message: 'Diet Coke',
        state: {
          mealType: 'snack',
          currentMealItems: [],
          pendingClarification: null,
          lastAssistantQuestion: null,
          userCorrections: [],
          saved: false,
          currentMealText: null,
          confidenceScore: 0.82,
        },
      },
      {
        apiKey: 'test-key',
        timeoutMs: 1,
        createChatCompletion: vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(completion(baconatorIntent())), 20))),
      },
    );

    expect(rateLimited).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(timedOut).toMatchObject({ ok: false, reason: 'timeout' });
  });
});
