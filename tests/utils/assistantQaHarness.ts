import type {
  MealAssistantContext,
  MealAssistantItem,
  MealAssistantModelOutput,
  MealAssistantResponse,
  MealAssistantState,
  MealAssistantTranscriptMessage,
} from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

export type AssistantQaScenario = {
  name: string;
  messages: string[];
  initialState?: Partial<MealAssistantState>;
  context?: Partial<MealAssistantContext>;
  resolveItemNutrition?: typeof resolveQaNutrition;
  classify?: (args: {
    message: string;
    state: MealAssistantState;
    context?: MealAssistantContext;
    conversationHistory?: MealAssistantTranscriptMessage[];
  }) => Promise<MealAssistantModelOutput>;
};

export type AssistantQaTurn = {
  scenarioName: string;
  turnIndex: number;
  userMessage: string;
  assistantReply: string;
  previousAssistantReply: string | null;
  previousState: MealAssistantState;
  response: MealAssistantResponse;
};

export type AssistantQaConversation = {
  scenarioName: string;
  turns: AssistantQaTurn[];
  finalState: MealAssistantState;
};

export function buildQaState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'lunch',
    userName: 'Tyler',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    lastAssistantReply: null,
    activeTopic: null,
    activeMode: null,
    activeQuestion: null,
    previousIntent: null,
    previousUserMessage: null,
    ...overrides,
  };
}

export function buildQaContext(overrides?: Partial<MealAssistantContext>): MealAssistantContext {
  return {
    favoriteMeals: [],
    recentMeals: [],
    assistantMemory: undefined,
    nutritionPreferences: null,
    proteinGoal: 160,
    dailyCalorieGoal: 2200,
    todayProtein: 97,
    todayCarbs: 170,
    todayFat: 55,
    todayCalories: 1480,
    remainingProtein: 63,
    remainingCarbs: 80,
    remainingFat: 25,
    remainingCalories: 720,
    todayMealCount: 1,
    ...overrides,
  };
}

export function createQaItem(args: {
  food_name: string;
  quantity?: number;
  unit?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  source_type?: ParsedFoodItem['source_type'];
  source_name?: string | null;
  original_user_text?: string | null;
}): ParsedFoodItem {
  const sourceType = args.source_type ?? 'GENERIC_REFERENCE';

  return {
    food_name: args.food_name,
    quantity: args.quantity ?? 1,
    unit: args.unit ?? 'serving',
    calories: args.calories,
    protein: args.protein ?? 0,
    carbs: args.carbs ?? 0,
    fat: args.fat ?? 0,
    fiber: args.fiber ?? 0,
    sugar: args.sugar ?? 0,
    sodium: args.sodium ?? 0,
    notes: sourceType === 'AI_ESTIMATE' ? 'QA fallback estimate.' : 'QA verified reference.',
    is_trusted: sourceType !== 'AI_ESTIMATE',
    source_type: sourceType,
    source_name: args.source_name ?? (sourceType === 'OFFICIAL_RESTAURANT' ? 'Official nutrition' : 'QA nutrition reference'),
    confidence_label: sourceType === 'AI_ESTIMATE' ? 'Estimated' : sourceType === 'OFFICIAL_RESTAURANT' ? 'Verified' : 'Matched',
    matched_query: null,
    original_user_text: args.original_user_text ?? null,
    provider_used: sourceType === 'AI_ESTIMATE' ? null : 'qa-resolver',
    used_ai_fallback: sourceType === 'AI_ESTIMATE',
    catalog_food_id: null,
  };
}

export function buildQaMealResponse(items: ParsedFoodItem[], mealType: MealAssistantState['mealType'] = 'lunch'): ParsedMealResponse {
  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: items.some((item) => item.source_type === 'AI_ESTIMATE') ? 0.84 : 0.96,
    items,
    totals: sumItems(items),
  };
}

export async function resolveQaNutrition(args: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }): Promise<ParsedMealResponse | null> {
  const phrase = normalize([args.item.brand ?? '', ...args.item.modifiers, args.item.name, args.item.unit ?? ''].filter(Boolean).join(' '));
  const quantity = args.item.quantity || 1;

  if (phrase.includes('mcdouble') && phrase.includes('fry')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'McDouble', quantity: 1, unit: 'burger', calories: 390, protein: 22, carbs: 33, fat: 19, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
      createQaItem({ food_name: 'Medium fries', quantity: 1, unit: 'order', calories: 340, protein: 4, carbs: 44, fat: 16, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('mcdouble')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'McDouble', quantity, unit: quantity === 1 ? 'burger' : 'burgers', calories: 390 * quantity, protein: 22 * quantity, carbs: 33 * quantity, fat: 19 * quantity, source_type: 'OFFICIAL_RESTAURANT', source_name: "McDonald's official nutrition" }),
    ], args.mealType);
  }

  if (phrase.includes('fairlife') || phrase.includes('core power')) {
    const isElite = phrase.includes('elite') || phrase.includes('42g') || phrase.includes('42');
    return buildQaMealResponse([
      createQaItem({
        food_name: isElite ? 'Fairlife Core Power Elite 42g Protein Shake' : 'Fairlife protein shake',
        quantity,
        unit: quantity === 1 ? 'bottle' : 'bottles',
        calories: (isElite ? 230 : 150) * quantity,
        protein: (isElite ? 42 : 30) * quantity,
        carbs: (isElite ? 8 : 4) * quantity,
        fat: (isElite ? 3.5 : 2.5) * quantity,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Fairlife nutrition reference',
      }),
    ], args.mealType);
  }

  if (phrase.includes('chipotle')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Chipotle chicken bowl', quantity: 1, unit: 'bowl', calories: 820, protein: 55, carbs: 82, fat: 28, fiber: 13, sodium: 1640, source_type: 'OFFICIAL_RESTAURANT', source_name: 'Chipotle official nutrition' }),
    ], args.mealType);
  }

  if (phrase.includes('beans')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Canned beans', quantity, unit: quantity === 1 ? 'can' : 'cans', calories: 300 * quantity, protein: 18 * quantity, carbs: 54 * quantity, fat: 2 * quantity, fiber: 14 * quantity, sodium: 900 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Canned beans reference' }),
    ], args.mealType);
  }

  if (phrase.includes('oatmeal') || phrase.includes('oats')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Oatmeal', quantity, unit: args.item.unit ?? 'serving', calories: 150 * quantity, protein: 5 * quantity, carbs: 27 * quantity, fat: 3 * quantity, fiber: 4 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Oatmeal reference' }),
    ], args.mealType);
  }

  if (phrase.includes('grilled chicken') || phrase.includes('chicken breast')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Grilled chicken breast', quantity, unit: args.item.unit ?? 'serving', calories: 135 * quantity, protein: 26 * quantity, carbs: 0, fat: 3 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Chicken breast reference' }),
    ], args.mealType);
  }

  if (phrase.includes('blueberries')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Blueberries', quantity, unit: args.item.unit ?? 'cup', calories: 85 * quantity, protein: 1 * quantity, carbs: 21 * quantity, fat: 0.5 * quantity, fiber: 3.5 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Blueberry reference' }),
    ], args.mealType);
  }

  if (phrase.includes('peanut butter')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Peanut butter', quantity, unit: args.item.unit ?? 'tbsp', calories: 95 * quantity, protein: 4 * quantity, carbs: 3 * quantity, fat: 8 * quantity, fiber: 1 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Peanut butter reference' }),
    ], args.mealType);
  }

  if (phrase.includes('guacamole') || phrase.includes('guac')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Guacamole', quantity, unit: args.item.unit ?? 'serving', calories: 230 * quantity, protein: 2 * quantity, carbs: 8 * quantity, fat: 22 * quantity, fiber: 6 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Guacamole reference' }),
    ], args.mealType);
  }

  if (phrase.includes('protein powder')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Protein powder', quantity, unit: args.item.unit ?? (quantity === 1 ? 'scoop' : 'scoops'), calories: 120 * quantity, protein: 24 * quantity, carbs: 3 * quantity, fat: 2 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Protein powder reference' }),
    ], args.mealType);
  }

  if (phrase.includes('greek yogurt')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Greek yogurt', quantity, unit: args.item.unit ?? 'serving', calories: 100 * quantity, protein: 17 * quantity, carbs: 6 * quantity, fat: 0.5 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Greek yogurt reference' }),
    ], args.mealType);
  }

  if (phrase.includes('coke zero') || phrase.includes('diet coke')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Coke Zero', quantity, unit: 'can', calories: 0, protein: 0, carbs: 0, fat: 0, source_type: 'GENERIC_REFERENCE', source_name: 'Coke Zero nutrition reference' }),
    ], args.mealType);
  }

  if (phrase.includes('fries') || phrase.includes('fry')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Fries', quantity, unit: quantity === 1 ? 'order' : 'orders', calories: 340 * quantity, protein: 4 * quantity, carbs: 44 * quantity, fat: 16 * quantity, source_type: 'AI_ESTIMATE', source_name: 'Fries common estimate' }),
    ], args.mealType);
  }

  if (phrase.includes('rice cakes')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Rice cakes', quantity, unit: quantity === 1 ? 'cake' : 'cakes', calories: 35 * quantity, protein: 1 * quantity, carbs: 7 * quantity, fat: 0, source_type: 'GENERIC_REFERENCE', source_name: 'Rice cake reference' }),
    ], args.mealType);
  }

  if (phrase.includes('rice')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Rice', quantity, unit: 'cup', calories: 205 * quantity, protein: 4 * quantity, carbs: 45 * quantity, fat: 0.5 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Rice reference' }),
    ], args.mealType);
  }

  if (phrase.includes('egg')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Eggs', quantity, unit: quantity === 1 ? 'egg' : 'eggs', calories: 70 * quantity, protein: 6 * quantity, carbs: 0.5 * quantity, fat: 5 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Egg reference' }),
    ], args.mealType);
  }

  if (phrase.includes('cottage cheese')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Cottage cheese', quantity, unit: args.item.unit ?? 'cup', calories: 180 * quantity, protein: 26 * quantity, carbs: 8 * quantity, fat: 5 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Cottage cheese reference' }),
    ], args.mealType);
  }

  if (phrase.includes('cheese')) {
    return buildQaMealResponse([
      createQaItem({ food_name: 'Cheese', quantity, unit: 'serving', calories: 110 * quantity, protein: 6 * quantity, carbs: 1 * quantity, fat: 9 * quantity, source_type: 'GENERIC_REFERENCE', source_name: 'Cheese reference' }),
    ], args.mealType);
  }

  return null;
}

export async function runQaScenario(scenario: AssistantQaScenario): Promise<AssistantQaConversation> {
  let state = buildQaState(scenario.initialState);
  const context = buildQaContext(scenario.context);
  const turns: AssistantQaTurn[] = [];
  const conversationHistory: MealAssistantTranscriptMessage[] = [];

  for (const [index, userMessage] of scenario.messages.entries()) {
    const previousState = cloneState(state);
    const previousAssistantReply = conversationHistory.filter((message) => message.role === 'assistant').at(-1)?.text ?? null;
    const response = await runMealAssistant(
      {
        message: userMessage,
        state,
        context,
        conversationHistory: [...conversationHistory],
      },
      {
        classify: scenario.classify,
        resolveItemNutrition: scenario.resolveItemNutrition ?? resolveQaNutrition,
        saveMeal: async () => undefined,
      },
    );

    const turn: AssistantQaTurn = {
      scenarioName: scenario.name,
      turnIndex: index,
      userMessage,
      assistantReply: response.assistant_reply,
      previousAssistantReply,
      previousState,
      response,
    };
    turns.push(turn);
    conversationHistory.push({ role: 'user', text: userMessage }, { role: 'assistant', text: response.assistant_reply });
    state = response.next_state;
  }

  return {
    scenarioName: scenario.name,
    turns,
    finalState: state,
  };
}

export function qaFailure(turn: AssistantQaTurn, reason: string, expectedBehavior: string) {
  const actualAction = [
    `intent=${turn.response.intent}`,
    `lookup=${turn.response.should_lookup_nutrition}`,
    `ask_clarification=${turn.response.should_ask_clarification}`,
    `save=${turn.response.should_save_meal}`,
    `decision_items=${turn.response.items.map((item) => `${item.quantity} ${item.name}`).join(', ') || 'none'}`,
  ].join('; ');

  return new Error([
    `Assistant QA failed: ${reason}`,
    `Scenario: ${turn.scenarioName}`,
    `Turn: ${turn.turnIndex + 1}`,
    `User message: ${turn.userMessage}`,
    `Assistant reply: ${turn.assistantReply}`,
    `Expected behavior: ${expectedBehavior}`,
    `Actual intent/action: ${actualAction}`,
    `Active meal state: ${formatMealState(turn.response.next_state)}`,
  ].join('\n'));
}

export function assertQa(condition: unknown, turn: AssistantQaTurn, reason: string, expectedBehavior: string): asserts condition {
  if (!condition) {
    throw qaFailure(turn, reason, expectedBehavior);
  }
}

export function expectBaselineQuality(turn: AssistantQaTurn) {
  expectNoDeadEndReply(turn);
  expectConciseReply(turn);
  expectNoGenericMixedMeal(turn);
  expectNoProductCopy(turn);
  expectNoRepeatedOpening(turn);
}

export function expectNoDeadEndReply(turn: AssistantQaTurn) {
  assertQa(
    !/^(?:got it|okay|ok|yep|yeah|sure|sounds good)[.!]*$/i.test(turn.assistantReply.trim()),
    turn,
    'Assistant gave a dead-end acknowledgement.',
    'Reply should answer the user intent with useful context.',
  );
}

export function expectConciseReply(turn: AssistantQaTurn, maxLength = 360) {
  assertQa(
    turn.assistantReply.length <= maxLength,
    turn,
    'Assistant reply was too long for mobile QA.',
    `Reply should stay at or below ${maxLength} characters.`,
  );
}

export function expectNoGenericMixedMeal(turn: AssistantQaTurn) {
  const haystack = `${turn.assistantReply} ${formatMealState(turn.response.next_state)}`;
  assertQa(
    !/estimated mixed meal|unknown food|food item/i.test(haystack),
    turn,
    'Assistant exposed a generic fallback food.',
    'Food identity should be preserved or clarified.',
  );
}

export function expectNoProductCopy(turn: AssistantQaTurn) {
  assertQa(
    !/\b(?:premium|mobile-first|product|dashboard|retention|startup)\b|that keeps this one on the lighter side/i.test(turn.assistantReply),
    turn,
    'Assistant sounded like product copy instead of a nutrition chat.',
    'Reply should feel like a user-facing food assistant.',
  );
}

export function expectNoRepeatedOpening(turn: AssistantQaTurn) {
  if (!turn.previousAssistantReply) {
    return;
  }

  const currentOpening = openingSignature(turn.assistantReply);
  const previousOpening = openingSignature(turn.previousAssistantReply);
  assertQa(
    !currentOpening || currentOpening !== previousOpening,
    turn,
    'Assistant repeated the same opening as the previous reply.',
    'Consecutive replies should vary naturally.',
  );
}

export function expectNoClarification(turn: AssistantQaTurn) {
  assertQa(
    !turn.response.should_ask_clarification && !turn.response.next_state.pendingClarification,
    turn,
    'Assistant asked an unnecessary clarification.',
    'Obvious loggable foods should be estimated without slowing the user down.',
  );
}

export function expectMealContains(turn: AssistantQaTurn, expectedFoods: RegExp[]) {
  const mealText = formatMealState(turn.response.next_state);
  for (const expectedFood of expectedFoods) {
    assertQa(
      expectedFood.test(mealText),
      turn,
      `Active meal did not contain ${expectedFood}.`,
      `Meal should include foods matching ${expectedFood}.`,
    );
  }
}

export function expectMealDoesNotContain(turn: AssistantQaTurn, forbiddenFoods: RegExp[]) {
  const mealText = formatMealState(turn.response.next_state);
  for (const forbiddenFood of forbiddenFoods) {
    assertQa(
      !forbiddenFood.test(mealText),
      turn,
      `Active meal contained forbidden food ${forbiddenFood}.`,
      `Meal should not include foods matching ${forbiddenFood}.`,
    );
  }
}

export function expectMealItemCount(turn: AssistantQaTurn, expectedCount: number) {
  assertQa(
    turn.response.next_state.currentMealItems.length === expectedCount,
    turn,
    'Active meal item count changed unexpectedly.',
    `Meal should contain exactly ${expectedCount} item(s).`,
  );
}

export function expectMealUnchanged(turn: AssistantQaTurn) {
  assertQa(
    mealSignature(turn.previousState.currentMealItems) === mealSignature(turn.response.next_state.currentMealItems),
    turn,
    'Assistant mutated the meal for a non-logging turn.',
    'Questions, recommendations, casual messages, and frustration should not change active meal state.',
  );
}

export function expectTotalCaloriesInRange(turn: AssistantQaTurn, min: number, max: number) {
  const totalCalories = sumItems(turn.response.next_state.currentMealItems).calories;
  assertQa(
    totalCalories >= min && totalCalories <= max,
    turn,
    `Total calories were outside range: ${totalCalories}.`,
    `Total calories should be between ${min} and ${max}.`,
  );
}

export function expectItemCaloriesInRange(turn: AssistantQaTurn, itemMatcher: RegExp, min: number, max: number) {
  const item = turn.response.next_state.currentMealItems.find((candidate) => itemMatcher.test(candidate.food_name));
  if (!item) {
    throw qaFailure(turn, `Expected food was missing: ${itemMatcher}.`, `Meal should include ${itemMatcher}.`);
  }

  assertQa(
    item.calories >= min && item.calories <= max,
    turn,
    `${item.food_name} calories were outside range: ${item.calories}.`,
    `${item.food_name} calories should be between ${min} and ${max}.`,
  );
}

export function expectReplyMatches(turn: AssistantQaTurn, matcher: RegExp, expectedBehavior: string) {
  assertQa(
    matcher.test(turn.assistantReply),
    turn,
    `Assistant reply did not match ${matcher}.`,
    expectedBehavior,
  );
}

export function expectReplyNotMatches(turn: AssistantQaTurn, matcher: RegExp, expectedBehavior: string) {
  assertQa(
    !matcher.test(turn.assistantReply),
    turn,
    `Assistant reply unexpectedly matched ${matcher}.`,
    expectedBehavior,
  );
}

export function expectCorrectionReply(turn: AssistantQaTurn) {
  assertQa(
    /\b(?:updated|changed|fixed|switched|removed|added|now|to)\b/i.test(turn.assistantReply),
    turn,
    'Correction reply did not mention what changed.',
    'Correction replies should summarize the edit.',
  );
}

export function expectRecommendationReply(turn: AssistantQaTurn) {
  const suggestionCount = ['chicken', 'turkey', 'salmon', 'steak', 'eggs', 'yogurt', 'cottage cheese', 'shake', 'fruit', 'bowl', 'tacos', 'potatoes']
    .filter((food) => new RegExp(`\\b${food}\\b`, 'i').test(turn.assistantReply)).length;

  assertQa(
    suggestionCount >= 2,
    turn,
    'Recommendation reply did not include enough actual food suggestions.',
    'Recommendation replies should suggest concrete foods.',
  );
}

export function expectNoUnrelatedFood(turn: AssistantQaTurn, forbiddenFoods: RegExp[]) {
  const haystack = `${turn.assistantReply} ${formatMealState(turn.response.next_state)}`;
  for (const forbiddenFood of forbiddenFoods) {
    assertQa(
      !forbiddenFood.test(haystack),
      turn,
      `Assistant drifted into unrelated food ${forbiddenFood}.`,
      `Reply and meal state should avoid ${forbiddenFood}.`,
    );
  }
}

export function expectTrustedSourceFor(turn: AssistantQaTurn, itemMatcher: RegExp) {
  const item = turn.response.next_state.currentMealItems.find((candidate) => itemMatcher.test(candidate.food_name));
  if (!item) {
    throw qaFailure(turn, `Expected food was missing for trust check: ${itemMatcher}.`, `Meal should include ${itemMatcher}.`);
  }

  assertQa(
    item.is_trusted && item.source_type !== 'AI_ESTIMATE' && !item.used_ai_fallback,
    turn,
    `${item.food_name} was not marked as a trusted/provider-backed match.`,
    `${item.food_name} should preserve trusted source metadata when the resolver provides it.`,
  );
}

function cloneState(state: MealAssistantState): MealAssistantState {
  return {
    ...state,
    currentMealItems: state.currentMealItems.map((item) => ({ ...item })),
    userCorrections: [...state.userCorrections],
  };
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openingSignature(text: string) {
  return normalize(text).split(' ').slice(0, 3).join(' ');
}

function sumItems(items: ParsedFoodItem[]) {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + Number(item.calories || 0),
      protein: total.protein + Number(item.protein || 0),
      carbs: total.carbs + Number(item.carbs || 0),
      fat: total.fat + Number(item.fat || 0),
      fiber: total.fiber + Number(item.fiber || 0),
      sugar: total.sugar + Number(item.sugar || 0),
      sodium: total.sodium + Number(item.sodium || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );
}

function mealSignature(items: ParsedFoodItem[]) {
  return items
    .map((item) => `${normalize(item.food_name)}:${item.quantity}:${item.unit}:${Math.round(item.calories)}`)
    .join('|');
}

function formatMealState(state: MealAssistantState) {
  if (!state.currentMealItems.length) {
    return 'empty';
  }

  const items = state.currentMealItems
    .map((item) => `${item.quantity} ${item.unit} ${item.food_name} (${Math.round(item.calories)} cal, P${Math.round(item.protein)} C${Math.round(item.carbs)} F${Math.round(item.fat)}, ${item.source_type ?? 'no-source'})`)
    .join(' | ');

  return `${items}; saved=${state.saved}; pending=${state.pendingClarification ?? 'none'}; text=${state.currentMealText ?? 'none'}`;
}
