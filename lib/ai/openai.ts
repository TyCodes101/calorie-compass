import OpenAI from 'openai';

import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { getMockParsedMeal } from '@/lib/ai/mock';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { finalizeParsedResponse, inferMealType, shouldUseDeterministicRestaurantEstimate } from '@/lib/ai/orchestrate';
import { getRestaurantEstimate } from '@/lib/ai/restaurant';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import type { ParsedMealResponse } from '@/lib/ai/types';

const model = process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';

export async function parseMealText(text: string, mealType?: string): Promise<ParsedMealResponse> {
  const analysis = analyzeMealText(text);
  const clarification = buildClarificationDecision(analysis);
  const inferredMealType = inferMealType(mealType, text);

  if (!clarification.needsClarification) {
    const trustedEstimate = getTrustedCatalogEstimate(text, inferredMealType);
    if (trustedEstimate) {
      return finalizeParsedResponse(analysis, trustedEstimate);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return getMockParsedMeal(text, mealType);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.15,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a nutrition estimation engine. Return only valid JSON. Be conservative and honest. If the meal is too vague, you may signal that clarification is needed, but do not ask more than one short follow-up question. If the meal is specific enough, estimate immediately. Prefer itemized outputs, preserve restaurant or brand information in notes when helpful, and never invent precision you do not have. Recognize common restaurant meals from brands like Chipotle, Starbucks, Chick-fil-A, and McDonald\'s when the user gives clear menu-like details. If the meal is a simple countable food with an explicit quantity, like bananas, eggs, apples, bagels, yogurt, rice cakes, toast, or protein bars, do not ask a follow-up question. Use a reasonable trusted default serving and go straight to review. Only ask about sauces, oils, or toppings when the food actually makes that relevant. Output keys: needs_clarification, clarifying_question, meal_type, confidence_score, items, totals. Items must include food_name, quantity, unit, calories, protein, carbs, fat, fiber, sugar, sodium, notes. Totals must include calories, protein, carbs, fat, fiber, sugar, sodium. Nutrition estimates are approximate and not medical advice.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          meal_text: text,
          suggested_meal_type: mealType ?? null,
          analysis_hints: {
            detected_brand: analysis.brand,
            category: analysis.category,
            specificity: analysis.specificity,
            has_portion: analysis.hasPortion,
            has_explicit_countable_quantity: analysis.hasExplicitCountableQuantity,
            looks_like_simple_countable_meal: analysis.looksLikeSimpleCountableMeal,
            has_cooking_style: analysis.hasCookingStyle,
            has_sauce_signal: analysis.hasSauceSignal,
          },
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return getMockParsedMeal(text, mealType);
  }

  try {
    const normalized = normalizeParsedMealResponse(JSON.parse(content));

    if (clarification.needsClarification && clarification.question) {
      return {
        ...normalized,
        needs_clarification: true,
        clarifying_question: clarification.question,
        confidence_score: scoreMealConfidence(analysis, { itemCount: 0, clarificationNeeded: true }),
        items: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
      };
    }

    const restaurantEstimate = getRestaurantEstimate(text, inferredMealType);

    if (restaurantEstimate && shouldUseDeterministicRestaurantEstimate(analysis)) {
      return finalizeParsedResponse(analysis, restaurantEstimate);
    }

    return finalizeParsedResponse(analysis, normalized);
  } catch {
    return getMockParsedMeal(text, mealType);
  }
}
