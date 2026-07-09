import { describe, expect, it } from 'vitest';

import {
  foodIntelligenceResultSchema,
  mapFoodIntelligenceToMealAssistantDecision,
} from '@/lib/ai/openaiFoodIntelligence';

type DecompositionItem = {
  rawText: string;
  canonicalName: string;
  restaurant?: string | null;
  brand?: string | null;
  category?: string | null;
  quantity?: { amount?: number | null; unit?: string | null; naturalUnit?: string | null };
  servingDefault?: { amount: number; unit: string; reason: string };
  modifiers?: Array<{ type: 'remove' | 'add' | 'extra' | 'light' | 'substitute' | 'preparation' | 'portion' | 'size'; target: string; text: string }>;
  mustIncludeTerms?: string[];
  mustNotMatchTerms?: string[];
  confidence?: number;
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
};

function decompositionResult(args: {
  restaurant?: string | null;
  brand?: string | null;
  mealName?: string | null;
  mealType?: 'restaurant' | 'branded' | 'generic' | 'homemade' | 'mixed' | 'unknown';
  items: DecompositionItem[];
}) {
  return {
    action: 'create_pending_meal',
    confidence: 0.91,
    mealContext: {
      restaurant: args.restaurant ?? null,
      brand: args.brand ?? null,
      mealName: args.mealName ?? null,
      mealType: args.mealType ?? 'mixed',
    },
    items: args.items.map((item) => ({
      rawText: item.rawText,
      canonicalName: item.canonicalName,
      restaurant: item.restaurant ?? args.restaurant ?? null,
      brand: item.brand ?? args.brand ?? null,
      category: item.category ?? null,
      quantity: {
        amount: item.quantity?.amount ?? null,
        unit: item.quantity?.unit ?? null,
        naturalUnit: item.quantity?.naturalUnit ?? null,
      },
      servingDefault: item.servingDefault ?? {
        amount: 1,
        unit: item.quantity?.naturalUnit ?? item.quantity?.unit ?? 'serving',
        reason: 'Use the natural serving from the user message or food category.',
      },
      modifiers: item.modifiers ?? [],
      mustIncludeTerms: item.mustIncludeTerms ?? [item.canonicalName],
      mustNotMatchTerms: item.mustNotMatchTerms ?? [],
      confidence: item.confidence ?? 0.9,
      needsClarification: item.needsClarification ?? false,
      clarificationQuestion: item.clarificationQuestion ?? null,
    })),
    ambiguity: {
      isAmbiguous: false,
      reason: null,
      clarificationQuestion: null,
    },
    userFacingMessage: 'I found this meal. Review it below before saving.',
  };
}

describe('OpenAI meal decomposition contract', () => {
  it('accepts strict decomposition output with meal context and per-item guardrails', () => {
    const parsed = foodIntelligenceResultSchema.safeParse(decompositionResult({
      restaurant: 'Panda Express',
      mealName: 'Bigger Plate',
      mealType: 'restaurant',
      items: [
        { rawText: 'orange chicken', canonicalName: 'Orange Chicken', category: 'entree' },
        { rawText: 'Beijing beef', canonicalName: 'Beijing Beef', category: 'entree' },
        { rawText: 'chow mein', canonicalName: 'Chow Mein', category: 'side' },
      ],
    }));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(3);
    }
  });

  it('maps decomposed Panda Express bigger plate into three independent resolver items', () => {
    const decision = mapFoodIntelligenceToMealAssistantDecision(decompositionResult({
      restaurant: 'Panda Express',
      mealName: 'Bigger Plate',
      mealType: 'restaurant',
      items: [
        { rawText: 'orange chicken', canonicalName: 'Orange Chicken', category: 'entree' },
        { rawText: 'Beijing beef', canonicalName: 'Beijing Beef', category: 'entree' },
        { rawText: 'chow mein', canonicalName: 'Chow Mein', category: 'side' },
      ],
    }) as never, 'Panda Express bigger plate: orange chicken, Beijing beef, chow mein');

    expect(decision.should_lookup_nutrition).toBe(true);
    expect(decision.should_save_meal).toBe(false);
    expect(decision.items.map((item) => item.name)).toEqual(['Orange Chicken', 'Beijing Beef', 'Chow Mein']);
    expect(decision.items.every((item) => item.brand === 'Panda Express')).toBe(true);
  });

  it('preserves brand kind and must-not-match terms for Diet Coke and Trader Joe gummies', () => {
    const decision = mapFoodIntelligenceToMealAssistantDecision(decompositionResult({
      brand: 'Coca-Cola',
      mealType: 'branded',
      items: [{
        rawText: 'Diet Coke',
        canonicalName: 'Diet Coke',
        brand: 'Coca-Cola',
        category: 'zero calorie soda',
        quantity: { amount: 1, unit: 'can', naturalUnit: 'can' },
        mustIncludeTerms: ['Diet Coke'],
        mustNotMatchTerms: ['NOS', 'Monster', 'energy drink'],
      }],
    }) as never, 'Diet Coke');

    expect(decision.items[0]).toMatchObject({
      name: 'Diet Coke',
      brand: 'Coca-Cola',
      unit: 'can',
    });
    expect(decision.items[0]?.modifiers.join(' ')).toMatch(/must not match: NOS/i);
  });

  it('preserves restaurant natural units and modifiers for Five Guys no-bun burger', () => {
    const decision = mapFoodIntelligenceToMealAssistantDecision(decompositionResult({
      restaurant: 'Five Guys',
      mealType: 'restaurant',
      items: [{
        rawText: 'bacon cheeseburger, no bun, extra grilled onions and mushrooms',
        canonicalName: 'Bacon cheeseburger',
        restaurant: 'Five Guys',
        category: 'burger',
        quantity: { amount: 1, unit: 'burger', naturalUnit: 'burger' },
        servingDefault: { amount: 1, unit: 'burger', reason: 'Restaurant burger natural serving.' },
        modifiers: [
          { type: 'remove', target: 'bun', text: 'no bun' },
          { type: 'extra', target: 'grilled onions', text: 'extra grilled onions' },
          { type: 'add', target: 'mushrooms', text: 'mushrooms' },
        ],
      }],
    }) as never, 'Five Guys bacon cheeseburger, no bun, extra grilled onions and mushrooms');

    expect(decision.items[0]).toMatchObject({
      name: 'Bacon cheeseburger',
      brand: 'Five Guys',
      quantity: 1,
      unit: 'burger',
    });
    expect(decision.items[0]?.modifiers.join(' ')).toMatch(/no bun|extra grilled onions|mushrooms/i);
  });
});
