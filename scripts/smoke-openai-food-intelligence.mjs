import OpenAI from 'openai';
import { z } from 'zod';

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MEAL_MODEL?.trim() || 'gpt-4.1-mini';

const MAX_OUTPUT_ITEMS = 12;
const MAX_MODIFIERS = 12;
const MAX_CANDIDATE_QUERIES = 8;
const MAX_MUST_NOT_MATCH = 8;
const MAX_RAW_TEXT_LENGTH = 240;
const MAX_NAME_LENGTH = 180;
const MAX_NOTE_LENGTH = 360;

function redact(value) {
  return String(value ?? '').replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-...redacted');
}

if (!apiKey) {
  console.error('OPENAI_API_KEY is required for this manual smoke script.');
  process.exit(1);
}

const boundedString = (maxLength) => z.string().trim().min(1).max(maxLength);
const nullableBoundedString = (maxLength) => boundedString(maxLength).nullable();

const actionSchema = z.enum([
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
]);

const resultSchema = z.object({
  action: actionSchema,
  confidence: z.number().min(0).max(1),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    reason: nullableBoundedString(MAX_NOTE_LENGTH),
    clarificationQuestion: nullableBoundedString(MAX_NOTE_LENGTH),
  }).strict(),
  items: z.array(z.object({
    rawText: boundedString(MAX_RAW_TEXT_LENGTH),
    normalizedName: boundedString(MAX_NAME_LENGTH),
    brandOrRestaurant: nullableBoundedString(MAX_NAME_LENGTH),
    foodType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown']),
    quantity: z.object({
      amount: z.number().positive().nullable(),
      unit: nullableBoundedString(48),
      servingText: nullableBoundedString(96),
    }).strict().nullable(),
    modifiers: z.array(z.object({
      type: z.enum(['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving']),
      text: boundedString(MAX_NAME_LENGTH),
      target: nullableBoundedString(MAX_NAME_LENGTH),
    }).strict()).max(MAX_MODIFIERS),
    candidateQueries: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_CANDIDATE_QUERIES),
    expectedIdentity: z.object({
      restaurant: nullableBoundedString(MAX_NAME_LENGTH),
      brand: nullableBoundedString(MAX_NAME_LENGTH),
      canonicalItem: nullableBoundedString(MAX_NAME_LENGTH),
      mustNotMatch: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_MUST_NOT_MATCH),
    }).strict().nullable(),
    nutritionExpectation: z.object({
      shouldBeZeroCalorieDrink: z.boolean(),
      shouldScaleWithQuantity: z.boolean(),
      shouldBeFootlong: z.boolean(),
      shouldBeNoCheese: z.boolean(),
      shouldBeEstimateOnly: z.boolean(),
    }).strict().nullable(),
  }).strict()).max(MAX_OUTPUT_ITEMS),
  userFacingMessage: nullableBoundedString(MAX_NOTE_LENGTH),
}).strict();

const jsonSchema = {
  name: 'food_intelligence_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'confidence', 'ambiguity', 'items', 'userFacingMessage'],
    properties: {
      action: { enum: actionSchema.options },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      ambiguity: {
        type: 'object',
        additionalProperties: false,
        required: ['isAmbiguous', 'reason', 'clarificationQuestion'],
        properties: {
          isAmbiguous: { type: 'boolean' },
          reason: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
          clarificationQuestion: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
        },
      },
      items: {
        type: 'array',
        maxItems: MAX_OUTPUT_ITEMS,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'rawText',
            'normalizedName',
            'brandOrRestaurant',
            'foodType',
            'quantity',
            'modifiers',
            'candidateQueries',
            'expectedIdentity',
            'nutritionExpectation',
          ],
          properties: {
            rawText: { type: 'string', maxLength: MAX_RAW_TEXT_LENGTH },
            normalizedName: { type: 'string', maxLength: MAX_NAME_LENGTH },
            brandOrRestaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
            foodType: { enum: ['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown'] },
            quantity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['amount', 'unit', 'servingText'],
              properties: {
                amount: { type: ['number', 'null'], exclusiveMinimum: 0 },
                unit: { type: ['string', 'null'], maxLength: 48 },
                servingText: { type: ['string', 'null'], maxLength: 96 },
              },
            },
            modifiers: {
              type: 'array',
              maxItems: MAX_MODIFIERS,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'text', 'target'],
                properties: {
                  type: { enum: ['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving'] },
                  text: { type: 'string', maxLength: MAX_NAME_LENGTH },
                  target: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                },
              },
            },
            candidateQueries: {
              type: 'array',
              maxItems: MAX_CANDIDATE_QUERIES,
              items: { type: 'string', maxLength: MAX_NAME_LENGTH },
            },
            expectedIdentity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['restaurant', 'brand', 'canonicalItem', 'mustNotMatch'],
              properties: {
                restaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                brand: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                canonicalItem: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                mustNotMatch: {
                  type: 'array',
                  maxItems: MAX_MUST_NOT_MATCH,
                  items: { type: 'string', maxLength: MAX_NAME_LENGTH },
                },
              },
            },
            nutritionExpectation: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: [
                'shouldBeZeroCalorieDrink',
                'shouldScaleWithQuantity',
                'shouldBeFootlong',
                'shouldBeNoCheese',
                'shouldBeEstimateOnly',
              ],
              properties: {
                shouldBeZeroCalorieDrink: { type: 'boolean' },
                shouldScaleWithQuantity: { type: 'boolean' },
                shouldBeFootlong: { type: 'boolean' },
                shouldBeNoCheese: { type: 'boolean' },
                shouldBeEstimateOnly: { type: 'boolean' },
              },
            },
          },
        },
      },
      userFacingMessage: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
    },
  },
};

const prompts = [
  "Wendy's Baconator",
  "Wendy's Baconnator",
  "Wendy's bacon cheeseburger",
  "Wendy's spicy chicken sandwich",
  'McDouble no cheese',
  "McDonald's McDouble without cheese",
  'Big Mac no pickles',
  'McChicken',
  'Chick-fil-A sandwich',
  'Chick-fil-A grilled nuggets',
  'Subway meatball footlong',
  'Subway meatball 6 inch',
  'Subway Italian BMT footlong',
  'Chipotle chicken bowl',
  'Chipotle steak bowl',
  "Arby's classic roast beef",
  'White Castle slider',
  'Taco Bell crunchwrap',
  'Burger King Whopper',
  'Popeyes chicken sandwich',
  'hot cheetos',
  'Flamin Hot Cheetos',
  'hot cheeots',
  'Quest BBQ chips',
  'Diet Coke',
  'Coke Zero',
  'diet cooe',
  'Fairlife protein shake',
  'Pop-Tarts',
  'Oreo cookies',
  '2 grilled chicken breasts and asparagus',
  'buttered corn on the cob',
  'scrambled eggs and toast',
  'breakfast sandwich',
  'bowl',
  'chicken sandwich',
  "where's my macros",
  'yes',
  'save it',
  'add McDouble no cheese',
  'replace with McDouble no cheese',
  'nvm',
  'undo',
  'start over',
];

const client = new OpenAI({ apiKey });
const schemaFailures = [];
const systemFailures = [];

console.error(`Running OpenAI food intelligence smoke with model ${model}. Key is ${redact(apiKey)}.`);

for (const prompt of prompts) {
  try {
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
            'You are the Calorie Compass food intelligence parser.',
            'You parse intent and food identity only.',
            'Never include calories, macros, source metadata, trust labels, or save state.',
            'Never save meals. Confirmation is intent only.',
            'Preserve restaurants, brands, quantities, serving sizes, modifiers, and ambiguity.',
            'Ask clarification when brand, restaurant, serving, or item identity is ambiguous.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            latest_user_message: prompt,
            state: {
              mealType: 'dinner',
              hasPendingMeal: true,
              pendingMealStatus: 'readyForReview',
              saved: false,
            },
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';
    let parsedJson;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      schemaFailures.push({ prompt, reason: 'invalid_json' });
      console.log(JSON.stringify({ prompt, fallbackNeeded: true, reason: 'invalid_json' }));
      continue;
    }

    const parsed = resultSchema.safeParse(parsedJson);
    if (!parsed.success) {
      schemaFailures.push({ prompt, reason: 'schema_invalid', issues: parsed.error.issues.map((issue) => issue.path.join('.')) });
      console.log(JSON.stringify({ prompt, fallbackNeeded: true, reason: 'schema_invalid' }));
      continue;
    }

    const mutatingAction = [
      'create_pending_meal',
      'add_to_pending_meal',
      'replace_pending_meal',
      'remove_from_pending_meal',
    ].includes(parsed.data.action);
    const missingCandidateQueries = mutatingAction
      && parsed.data.items.some((item) => item.candidateQueries.length === 0);
    const flags = [
      parsed.data.confidence < 0.45 ? 'low_confidence' : null,
      parsed.data.ambiguity.isAmbiguous ? 'ambiguous' : null,
      missingCandidateQueries ? 'missing_candidate_queries' : null,
    ].filter(Boolean);

    console.log(JSON.stringify({
      prompt,
      action: parsed.data.action,
      confidence: parsed.data.confidence,
      ambiguity: parsed.data.ambiguity,
      flags,
      fallbackNeeded: parsed.data.ambiguity.isAmbiguous || parsed.data.confidence < 0.45,
      items: parsed.data.items.map((item) => ({
        normalizedName: item.normalizedName,
        brandOrRestaurant: item.brandOrRestaurant,
        foodType: item.foodType,
        quantity: item.quantity,
        modifiers: item.modifiers,
        candidateQueries: item.candidateQueries,
      })),
    }));
  } catch (error) {
    systemFailures.push({ prompt, message: redact(error instanceof Error ? error.message : String(error)) });
    console.log(JSON.stringify({ prompt, fallbackNeeded: true, reason: 'system_failure' }));
  }
}

if (schemaFailures.length || systemFailures.length) {
  console.error(JSON.stringify({
    schemaFailures,
    systemFailures,
  }, null, 2));
  process.exit(1);
}

console.error(`OpenAI food intelligence smoke completed for ${prompts.length} prompts.`);
