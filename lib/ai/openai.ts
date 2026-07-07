import OpenAI from 'openai';

import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';
import { scoreMealConfidence } from '@/lib/ai/confidence';
import { getMockParsedMeal } from '@/lib/ai/mock';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { finalizeParsedResponse, inferMealType } from '@/lib/ai/orchestrate';
import { hydrateParsedMealWithProviders } from '@/lib/nutrition/nutritionLookup';
import { resolveNutritionEstimate, type NutritionLabelInput } from '@/lib/nutrition/resolver';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { openaiMealModel } from '@/lib/ai/openaiConfig';

const model = openaiMealModel;

type ConversationContext = {
  mode?: 'new' | 'clarification' | 'correction';
  previousMealText?: string | null;
  correctionText?: string | null;
  currentItems?: ParsedFoodItem[];
};

function buildEffectiveMealText(text: string, conversation?: ConversationContext) {
  if (conversation?.mode === 'correction' && conversation.previousMealText && conversation.correctionText) {
    return `${conversation.previousMealText}\nCorrection: ${conversation.correctionText}`;
  }

  if (conversation?.mode === 'clarification' && conversation.previousMealText) {
    return `${conversation.previousMealText}\nAdditional detail: ${text}`;
  }

  return text;
}

async function finalizeDatabaseFirstResponse(analysis: ReturnType<typeof analyzeMealText>, response: ParsedMealResponse) {
  const hydrated = await hydrateParsedMealWithProviders(response);
  return finalizeParsedResponse(analysis, hydrated);
}

export async function parseMealText(
  text: string,
  mealType?: string,
  options?: {
    barcode?: string | null;
    nutritionLabel?: NutritionLabelInput | null;
    userPreferences?: string | null;
    conversation?: ConversationContext;
  }
): Promise<ParsedMealResponse> {
  const effectiveText = buildEffectiveMealText(text, options?.conversation);
  const analysis = analyzeMealText(effectiveText);
  const clarification = options?.conversation?.mode === 'correction' ? { needsClarification: false, question: null } : buildClarificationDecision(analysis);
  const inferredMealType = inferMealType(mealType, effectiveText);
  const hasDirectNutritionInput = Boolean(options?.barcode || options?.nutritionLabel);

  if (hasDirectNutritionInput) {
    const resolvedEstimate = await resolveNutritionEstimate({
      text: effectiveText,
      mealType: inferredMealType,
      barcode: options?.barcode,
      nutritionLabel: options?.nutritionLabel,
    });

    if (resolvedEstimate) {
      return finalizeParsedResponse(analysis, resolvedEstimate);
    }
  }

  if (!clarification.needsClarification) {
    const resolvedEstimate = await resolveNutritionEstimate({
      text: effectiveText,
      mealType: inferredMealType,
      barcode: options?.barcode,
      nutritionLabel: options?.nutritionLabel,
    });

    if (resolvedEstimate) {
      return finalizeParsedResponse(analysis, resolvedEstimate);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return finalizeDatabaseFirstResponse(analysis, getMockParsedMeal(effectiveText, mealType));
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
          'You are Calorie Compass, a calm, concise, trustworthy nutrition assistant. Return only valid JSON. Think like a real assistant even though your output is structured. Be conservative and honest. If the meal is specific enough, estimate it immediately. Prefer estimation first when a reasonable default exists, then let the user adjust. If conversation context says this is a correction, revise the current meal instead of starting over. Handle changes like remove cheese, add fries, make it grilled, change it to lunch, protein was 42g, or that was 230 calories as updates to the current meal. If conversation context says this is a clarification, use the added detail to tighten the estimate without changing unrelated parts. Do not ask more than one short, human-sounding follow-up question. Generic meals like chips, protein shakes, sandwiches, salads, bowls, and fries require clarification before nutrition is returned unless the user provides a clear brand, restaurant, serving, or preparation. Pasta, tacos, and burgers may be estimated only when the description gives enough context for a plausible default. Prefer itemized outputs, preserve restaurant or brand information in notes when helpful, and never invent precision you do not have. Recognize common restaurant meals from brands like Chipotle, Starbucks, Chick-fil-A, McDonald\'s, and Fairlife when the user gives clear menu-like details. If the meal is a simple countable food with an explicit quantity, do not ask a follow-up question. Use a reasonable trusted default serving and go straight to review. Only ask about sauces, oils, toppings, or preparation when the food actually makes that relevant. If user preferences are provided, use them only as soft context. Never let them override the explicit meal description. Output keys: needs_clarification, clarifying_question, meal_type, confidence_score, items, totals. Items must include food_name, quantity, unit, calories, protein, carbs, fat, fiber, sugar, sodium, notes. Totals must include calories, protein, carbs, fat, fiber, sugar, sodium. Nutrition estimates are approximate and not medical advice.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          meal_text: effectiveText,
          suggested_meal_type: mealType ?? null,
          user_preferences: options?.userPreferences ?? null,
          conversation_context: options?.conversation
            ? {
                mode: options.conversation.mode ?? 'new',
                previous_meal_text: options.conversation.previousMealText ?? null,
                correction_text: options.conversation.correctionText ?? null,
                current_items:
                  options.conversation.currentItems?.map((item) => ({
                    food_name: item.food_name,
                    quantity: item.quantity,
                    unit: item.unit,
                    calories: item.calories,
                    protein: item.protein,
                  })) ?? [],
              }
            : null,
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
    return getMockParsedMeal(effectiveText, mealType);
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

    return finalizeDatabaseFirstResponse(analysis, normalized);
  } catch {
    return finalizeDatabaseFirstResponse(analysis, getMockParsedMeal(effectiveText, mealType));
  }
}
