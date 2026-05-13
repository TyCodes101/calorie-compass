import OpenAI from 'openai';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedMealResponse } from '@/lib/ai/types';

const model = process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';

export async function parseMealText(text: string, mealType?: string): Promise<ParsedMealResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return getMockParsedMeal(text, mealType);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a nutrition estimation engine. Return only valid JSON. If the meal is too vague, set needs_clarification to true and ask one concise follow-up question. If the meal is specific enough, estimate immediately. Output keys: needs_clarification, clarifying_question, meal_type, confidence_score, items, totals. Items must include food_name, quantity, unit, calories, protein, carbs, fat, fiber, sugar, sodium, notes. Totals must include calories, protein, carbs, fat, fiber, sugar, sodium. Nutrition estimates are approximate.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          meal_text: text,
          suggested_meal_type: mealType ?? null,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return getMockParsedMeal(text, mealType);
  }

  try {
    return normalizeParsedMealResponse(JSON.parse(content));
  } catch {
    return getMockParsedMeal(text, mealType);
  }
}
