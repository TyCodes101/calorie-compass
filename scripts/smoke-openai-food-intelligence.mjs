import OpenAI from 'openai';
import { z } from 'zod';

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MEAL_MODEL?.trim() || 'gpt-4.1-mini';

if (!apiKey) {
  console.error('OPENAI_API_KEY is required for this manual smoke script.');
  process.exit(1);
}

const resultSchema = z.object({
  action: z.enum([
    'create_pending_meal',
    'add_to_pending_meal',
    'replace_pending_meal',
    'remove_from_pending_meal',
    'answer_pending_macros',
    'confirm_save',
    'cancel_pending_meal',
    'undo',
    'ask_clarification',
    'no_op',
  ]),
  confidence: z.number().min(0).max(1),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    reason: z.string().nullable(),
    clarificationQuestion: z.string().nullable(),
  }),
  items: z.array(z.object({
    rawText: z.string(),
    normalizedName: z.string(),
    brandOrRestaurant: z.string().nullable(),
    foodType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown']),
    quantity: z.object({
      amount: z.number().positive().nullable(),
      unit: z.string().nullable(),
      servingText: z.string().nullable(),
    }).nullable(),
    modifiers: z.array(z.object({
      type: z.enum(['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving']),
      text: z.string(),
      target: z.string().nullable(),
    })),
    candidateQueries: z.array(z.string()),
    expectedIdentity: z.object({
      restaurant: z.string().nullable(),
      brand: z.string().nullable(),
      canonicalItem: z.string().nullable(),
      mustNotMatch: z.array(z.string()),
    }).nullable(),
    nutritionExpectation: z.object({
      shouldBeZeroCalorieDrink: z.boolean(),
      shouldScaleWithQuantity: z.boolean(),
      shouldBeFootlong: z.boolean(),
      shouldBeNoCheese: z.boolean(),
      shouldBeEstimateOnly: z.boolean(),
    }).nullable(),
  })),
  userFacingMessage: z.string().nullable(),
});

const prompts = [
  "Wendy's Baconator",
  "Wendy's Baconnator",
  'McDouble no cheese',
  "McDonald's McDouble without cheese",
  'Subway meatball footlong',
  'Chipotle chicken bowl',
  "Arby's roast beef",
  'Flamin Hot Cheetos',
  'hot cheeots',
  'Diet Coke',
  'diet cooe',
  '2 grilled chicken breasts and asparagus',
  'buttered corn on the cob',
  'breakfast sandwich',
  'bowl',
  'chicken sandwich',
  "where's my macros",
  'yes',
  'add McDouble no cheese',
  'replace with McDouble no cheese',
];

const jsonSchema = {
  name: 'food_intelligence_result',
  strict: false,
  schema: {
    type: 'object',
    required: ['action', 'confidence', 'ambiguity', 'items', 'userFacingMessage'],
    properties: {
      action: { enum: resultSchema.shape.action.options },
      confidence: { type: 'number' },
      ambiguity: { type: 'object' },
      items: { type: 'array' },
      userFacingMessage: { type: ['string', 'null'] },
    },
  },
};

const client = new OpenAI({ apiKey });

for (const prompt of prompts) {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: jsonSchema,
    },
    messages: [
      {
        role: 'system',
        content: [
          'You are the Calorie Compass food intent parser.',
          'Return JSON only. Parse intent and identity, not nutrition.',
          'Never include calories, macros, source metadata, or save state.',
          'Ask clarification when ambiguous.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          latest_user_message: prompt,
          state: { mealType: 'dinner', hasPendingMeal: true, saved: false },
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '';
  const parsed = resultSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.log(JSON.stringify({ prompt, fallbackNeeded: true, reason: 'schema_invalid' }, null, 2));
    continue;
  }

  console.log(JSON.stringify({
    prompt,
    action: parsed.data.action,
    confidence: parsed.data.confidence,
    ambiguity: parsed.data.ambiguity,
    items: parsed.data.items.map((item) => ({
      normalizedName: item.normalizedName,
      brandOrRestaurant: item.brandOrRestaurant,
      foodType: item.foodType,
      quantity: item.quantity,
      modifiers: item.modifiers,
      candidateQueries: item.candidateQueries,
    })),
    fallbackNeeded: parsed.data.ambiguity.isAmbiguous || parsed.data.confidence < 0.45,
  }, null, 2));
}
