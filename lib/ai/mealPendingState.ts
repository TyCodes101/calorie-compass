import type { MealAssistantState, PendingMeal } from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

type Totals = ParsedMealResponse['totals'];

const ACTIVE_PENDING_STATUSES = new Set<PendingMeal['status']>(['resolving', 'readyForReview', 'saving', 'failed']);
const PENDING_TTL_MS = 1000 * 60 * 60 * 18;

export function sumPendingTotals(items: ParsedFoodItem[]): Totals {
  return items.reduce<Totals>(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      fiber: acc.fiber + Number(item.fiber || 0),
      sugar: acc.sugar + Number(item.sugar || 0),
      sodium: acc.sodium + Number(item.sodium || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );
}

export function hasActivePendingMeal(state: MealAssistantState) {
  return Boolean(getActivePendingMeal(state));
}

export function getActivePendingMeal(state: MealAssistantState) {
  const pendingMeal = state.pendingMeal;
  if (!pendingMeal || !ACTIVE_PENDING_STATUSES.has(pendingMeal.status)) {
    return null;
  }
  if (isPendingMealExpired(pendingMeal)) {
    return null;
  }
  return pendingMeal;
}

export function isPendingMealExpired(pendingMeal: PendingMeal | null | undefined, now = new Date()) {
  if (!pendingMeal) {
    return false;
  }
  if (pendingMeal.status === 'stale') {
    return true;
  }
  if (!pendingMeal.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(pendingMeal.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

export function migratePendingMealState(state: MealAssistantState, now = new Date()): MealAssistantState {
  const pendingMeal = state.pendingMeal;
  if (pendingMeal && isPendingMealExpired(pendingMeal, now) && ACTIVE_PENDING_STATUSES.has(pendingMeal.status)) {
    return {
      ...state,
      pendingMeal: {
        ...pendingMeal,
        status: 'stale',
        updatedAt: now.toISOString(),
      },
      currentMealItems: [],
      saved: false,
    };
  }

  const activePending = getActivePendingMeal(state);
  if (activePending) {
    return {
      ...state,
      mealType: activePending.mealType,
      currentMealItems: cloneItems(activePending.items),
      currentMealText: activePending.displayTitle,
      confidenceScore: activePending.confidenceScore,
      saved: false,
    };
  }

  if (!pendingMeal && state.currentMealItems.length && !state.saved) {
    return createReadyPendingMeal({
      state,
      items: state.currentMealItems,
      rawText: state.currentMealText,
      mealType: state.mealType,
      now,
      replace: true,
    });
  }

  return {
    ...state,
    currentMealItems: cloneItems(state.currentMealItems),
  };
}

export function createReadyPendingMeal(args: {
  state: MealAssistantState;
  items: ParsedFoodItem[];
  rawText: string | null;
  mealType?: MealAssistantState['mealType'];
  now?: Date;
  replace?: boolean;
}) {
  const now = args.now ?? new Date();
  const previous = args.replace === false ? getActivePendingMeal(args.state) : null;
  const items = cloneItems(args.items);
  const mealType = args.mealType ?? args.state.mealType;
  const createdAt = previous?.createdAt ?? now.toISOString();
  const displayTitle = buildPendingMealDisplayTitle(args.rawText, items);
  const version = previous ? previous.version + 1 : 1;
  const id = previous?.id ?? createPendingMealId(now, displayTitle);
  const pendingMeal: PendingMeal = {
    id,
    version,
    status: 'readyForReview',
    mealType,
    displayTitle,
    rawText: args.rawText?.trim() || args.state.currentMealText || displayTitle,
    items,
    totals: sumPendingTotals(items),
    confidenceScore: getPendingConfidenceScore(items, args.state.confidenceScore),
    createdAt,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    savedMealId: previous?.savedMealId ?? null,
    idempotencyKey: `${id}:v${version}`,
  };

  return {
    ...args.state,
    pendingMeal,
    currentMealItems: cloneItems(items),
    mealType,
    currentMealText: displayTitle,
    confidenceScore: pendingMeal.confidenceScore,
    pendingClarification: null,
    pendingClarificationDetails: null,
    lastAssistantQuestion: null,
    saved: false,
  } satisfies MealAssistantState;
}

export function syncPendingMealWithCurrentItems(state: MealAssistantState) {
  const pendingMeal = getActivePendingMeal(state);
  if (!pendingMeal || state.saved || !state.currentMealItems.length) {
    return state;
  }

  if (itemSignature(pendingMeal.items) === itemSignature(state.currentMealItems)) {
    return state;
  }

  return createReadyPendingMeal({
    state,
    items: state.currentMealItems,
    rawText: state.currentMealText ?? pendingMeal.rawText,
    mealType: state.mealType,
    replace: false,
  });
}

export function updatePendingMealType(state: MealAssistantState, mealType: MealAssistantState['mealType'], now = new Date()) {
  const migrated = migratePendingMealState(state, now);
  const pendingMeal = getActivePendingMeal(migrated);
  if (!pendingMeal) {
    return {
      ...migrated,
      mealType,
    };
  }

  return {
    ...migrated,
    mealType,
    pendingMeal: {
      ...pendingMeal,
      mealType,
      version: pendingMeal.version + 1,
      updatedAt: now.toISOString(),
      idempotencyKey: `${pendingMeal.id}:v${pendingMeal.version + 1}`,
    },
    currentMealItems: cloneItems(pendingMeal.items),
    currentMealText: pendingMeal.displayTitle,
    confidenceScore: pendingMeal.confidenceScore,
    saved: false,
    pendingClarification: null,
    pendingClarificationDetails: null,
    lastAssistantQuestion: null,
  } satisfies MealAssistantState;
}

export function discardPendingMeal(state: MealAssistantState, now = new Date()) {
  const pendingMeal = state.pendingMeal;
  return {
    ...state,
    pendingMeal: pendingMeal
      ? {
          ...pendingMeal,
          status: 'discarded',
          updatedAt: now.toISOString(),
        }
      : null,
    currentMealItems: [],
    currentMealText: null,
    confidenceScore: 0.82,
    saved: false,
    pendingClarification: null,
    lastAssistantQuestion: null,
  } satisfies MealAssistantState;
}

export function markPendingMealSaved(state: MealAssistantState, now = new Date()) {
  const pendingMeal = state.pendingMeal;
  const sourceItems = state.currentMealItems.length
    ? cloneItems(state.currentMealItems)
    : pendingMeal?.items.length
      ? cloneItems(pendingMeal.items)
      : [];
  if (!pendingMeal) {
    return {
      ...state,
      currentMealItems: sourceItems,
      saved: true,
      pendingClarification: null,
      pendingClarificationDetails: null,
      lastAssistantQuestion: null,
    };
  }

  const totals = sumPendingTotals(sourceItems);
  const confidenceScore = getPendingConfidenceScore(sourceItems, state.confidenceScore);
  return {
    ...state,
    pendingMeal: {
      ...pendingMeal,
      status: 'saved',
      items: sourceItems,
      totals,
      confidenceScore,
      displayTitle: buildPendingMealDisplayTitle(state.currentMealText ?? pendingMeal.rawText, sourceItems),
      updatedAt: now.toISOString(),
    },
    currentMealItems: cloneItems(sourceItems),
    currentMealText: buildPendingMealDisplayTitle(state.currentMealText ?? pendingMeal.rawText, sourceItems),
    confidenceScore,
    saved: true,
    pendingClarification: null,
    pendingClarificationDetails: null,
    lastAssistantQuestion: null,
  } satisfies MealAssistantState;
}

export function markPendingMealSaveFailed(state: MealAssistantState, now = new Date()) {
  const pendingMeal = state.pendingMeal;
  const sourceItems = state.currentMealItems.length
    ? cloneItems(state.currentMealItems)
    : pendingMeal?.items.length
      ? cloneItems(pendingMeal.items)
      : [];

  if (!pendingMeal) {
    return {
      ...state,
      currentMealItems: sourceItems,
      currentMealText: state.currentMealText ?? (sourceItems.length ? buildPendingMealDisplayTitle(null, sourceItems) : null),
      confidenceScore: sourceItems.length ? getPendingConfidenceScore(sourceItems, state.confidenceScore) : state.confidenceScore,
      saved: false,
      pendingClarification: null,
      pendingClarificationDetails: null,
      lastAssistantQuestion: null,
    } satisfies MealAssistantState;
  }

  const totals = sumPendingTotals(sourceItems);
  const confidenceScore = getPendingConfidenceScore(sourceItems, state.confidenceScore);
  return {
    ...state,
    pendingMeal: {
      ...pendingMeal,
      status: 'failed',
      items: sourceItems,
      totals,
      confidenceScore,
      displayTitle: buildPendingMealDisplayTitle(state.currentMealText ?? pendingMeal.rawText, sourceItems),
      updatedAt: now.toISOString(),
    },
    currentMealItems: cloneItems(sourceItems),
    currentMealText: buildPendingMealDisplayTitle(state.currentMealText ?? pendingMeal.rawText, sourceItems),
    confidenceScore,
    saved: false,
    pendingClarification: null,
    pendingClarificationDetails: null,
    lastAssistantQuestion: null,
  } satisfies MealAssistantState;
}

export function buildPendingReviewReply(state: MealAssistantState) {
  const pendingMeal = getActivePendingMeal(state);
  if (!pendingMeal) {
    return null;
  }
  const totals = pendingMeal.totals;
  const sourceSummary = buildPendingSourceSummary(pendingMeal.items);
  const opening = /^Ready to review\b/i.test(state.lastAssistantReply ?? '')
    ? 'Reviewing'
    : 'Ready to review';
  return `${opening} ${pendingMeal.displayTitle} for ${pendingMeal.mealType}: ${Math.round(totals.calories)} calories, P${Math.round(totals.protein)}g C${Math.round(totals.carbs)}g F${Math.round(totals.fat)}g. ${sourceSummary} Save when ready.`;
}

export function buildPendingMealMacroReply(state: MealAssistantState) {
  const pendingMeal = getActivePendingMeal(state);
  if (!pendingMeal) {
    return null;
  }
  const totals = pendingMeal.totals;
  return `Pending review estimate: about ${Math.round(totals.calories)} calories, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, and ${Math.round(totals.fat)}g fat for ${pendingMeal.displayTitle}. Save to add it to today.`;
}

export function buildSavedMealMacroReply(state: MealAssistantState) {
  const items = state.pendingMeal?.status === 'saved'
    ? state.pendingMeal.items
    : state.saved
      ? state.currentMealItems
      : [];
  if (!items.length) {
    return null;
  }
  const totals = state.pendingMeal?.status === 'saved' ? state.pendingMeal.totals : sumPendingTotals(items);
  return `Saved meal macros: about ${Math.round(totals.calories)} calories, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, and ${Math.round(totals.fat)}g fat.`;
}

export function buildNoMealMacroReply() {
  return 'No foods logged yet. Send a meal or food item and I will estimate the macros before you save.';
}

export function buildStalePendingReply() {
  return 'That pending meal is too old to trust now. Send the food again and I will rebuild the review card before saving.';
}

export function isMacroRequestMessage(message: string, hasMealState = false) {
  const normalized = message.toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]+/g, ' ').trim();

  if (/\b(?:recommend|suggest|idea|ideas|what should i|what should we|breakfast|lunch|dinner|snack|shake|bar|smoothie|left|remaining)\b/.test(compact)) {
    return /\b(?:where'?s|wheres|provide|probide|show)\b.*\bmacros?\b/.test(normalized);
  }

  if (/^(?:macros?|calories?|cals?|protein|carbs?|fat)\??$/.test(compact)) {
    return true;
  }

  if (/\b(?:where'?s|wheres|provide|probide|show|what are)\b.*\bmacros?\b/.test(normalized)) {
    return true;
  }

  if (hasMealState && /\b(?:what about|how about|how much|how many|what(?:'s| is))\b.*\b(?:calories?|cals?|protein|carbs?|fat)\b/.test(normalized)) {
    return true;
  }

  return false;
}

export function extractMealTypeCorrection(message: string): MealAssistantState['mealType'] | null {
  const normalized = message
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const standaloneMatch =
    normalized.match(/^(?:for )?(breakfast|lunch|dinner|snack)(?: actually| instead)?$/)
    ?? normalized.match(/^(?:it|that|this)?\s*(?:was|is)\s+(?:for\s+)?(breakfast|lunch|dinner|snack)(?:\s+actually|\s+instead)?$/)
    ?? normalized.match(/^(?:actually|instead)\s+(?:(?:it|that|this)\s+)?(?:(?:was|is)\s+)?(?:for\s+)?(breakfast|lunch|dinner|snack)$/)
    ?? normalized.match(/^(?:make|change|switch|update)\s+(?:it|that|this)?\s*(?:to\s+)?(?:a\s+)?(breakfast|lunch|dinner|snack)$/)
    ?? normalized.match(/^(?:make that|change that|switch that|update that)\s+(?:to\s+)?(?:a\s+)?(breakfast|lunch|dinner|snack)$/);
  const mealType = standaloneMatch?.[1];
  if (mealType !== 'breakfast' && mealType !== 'lunch' && mealType !== 'dinner' && mealType !== 'snack') {
    return null;
  }
  return mealType;
}

export function isPendingDiscardMessage(message: string) {
  return /^(?:delete|discard|clear|cancel|reset|start over)(?:\s+(?:that|it|this|meal|entry|everything|nvm|nevermind|never mind))*[.! ]*$/i.test(message.trim());
}

export function isIrrelevantModifierRemoval(message: string, state: MealAssistantState) {
  const normalized = message.toLowerCase();
  if (/^(?:no|nah|nope|wrong|try again)[!. ]*$|^(?:no|nah|nope)\s+(?:that|this|it)?\s*(?:is|was|'s)?\s*(?:wrong|not right|way off|not even close)\b|\b(?:wrong|not right|way off|not even close)\b/.test(normalized)) {
    return false;
  }
  const removal = normalized.match(/^(?:no|without|remove|delete|hold|skip|take out)\s+([a-z ]+?)[.! ]*$/);
  const modifier = removal?.[1]?.trim();
  const pendingMeal = getActivePendingMeal(state);
  if (!modifier || !pendingMeal) {
    return false;
  }

  const modifierTokens = tokenize(modifier);
  const removableModifierTokens = new Set(['sauce', 'salsa', 'ranch', 'mayo', 'mayonnaise', 'cheese', 'guac', 'guacamole', 'dressing', 'butter', 'oil', 'cream']);
  if ([...modifierTokens].every((token) => !removableModifierTokens.has(token))) {
    return false;
  }
  if (!modifierTokens.size) {
    return false;
  }
  return pendingMeal.items.every((item) => {
    const itemTokens = tokenize(`${item.food_name} ${item.notes ?? ''}`);
    for (const token of modifierTokens) {
      if (itemTokens.has(token)) {
        return false;
      }
    }
    return true;
  });
}

export function buildIrrelevantModifierReply(message: string, state: MealAssistantState) {
  const modifier = message.toLowerCase().replace(/^(?:no|without|remove|delete|hold|skip|take out)\s+/, '').replace(/[.! ]+$/, '') || 'that';
  const pendingMeal = getActivePendingMeal(state);
  const label = pendingMeal?.displayTitle ?? 'that meal';
  return `I do not see ${modifier} on ${label}, so I left the pending meal unchanged. Tell me which item to change if I missed it.`;
}

export function markPendingMealStale(state: MealAssistantState, now = new Date()) {
  if (!state.pendingMeal) {
    return state;
  }
  return {
    ...state,
    pendingMeal: {
      ...state.pendingMeal,
      status: 'stale',
      updatedAt: now.toISOString(),
    },
    currentMealItems: [],
    saved: false,
  } satisfies MealAssistantState;
}

function cloneItems(items: ParsedFoodItem[]) {
  return items.map((item) => ({ ...item }));
}

function buildPendingMealDisplayTitle(rawText: string | null | undefined, items: ParsedFoodItem[]) {
  const cleanedRawText = rawText?.trim().replace(/[.!?]+$/, '') ?? '';
  const names = items.map((item) => item.food_name.trim()).filter(Boolean);
  if (!names.length) {
    return cleanedRawText || 'meal';
  }
  if (names.length === 1) {
    return formatPendingMealItemTitle(items[0]);
  }
  const labels = items.map(formatPendingMealItemTitle);
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

function formatPendingMealItemTitle(item: ParsedFoodItem) {
  const quantity = Number(item.quantity || 0);
  const unit = item.unit.trim();
  const name = item.food_name.trim();
  const lowerUnit = unit.toLowerCase();

  if (!quantity || quantity === 1) {
    return name;
  }

  if (/^(?:g|gram|grams)$/.test(lowerUnit)) {
    return `${formatQuantity(quantity)}g ${name}`;
  }

  if (/^(?:oz|ounce|ounces)$/.test(lowerUnit)) {
    return `${formatQuantity(quantity)} oz ${name}`;
  }

  const pluralUnit = quantity === 1 || lowerUnit.endsWith('s') ? unit : `${unit}s`;
  const lowerName = name.toLowerCase();
  if (lowerName === pluralUnit.toLowerCase() || lowerName.includes(` ${pluralUnit.toLowerCase()}`) || lowerName.startsWith(`${pluralUnit.toLowerCase()} `)) {
    return `${formatQuantity(quantity)} ${name}`;
  }
  if (lowerName === lowerUnit || lowerName.includes(` ${lowerUnit}`) || lowerName.startsWith(`${lowerUnit} `)) {
    return `${formatQuantity(quantity)} ${name}`;
  }
  return `${formatQuantity(quantity)} ${pluralUnit} of ${name}`;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function buildPendingSourceSummary(items: ParsedFoodItem[]) {
  if (!items.length) {
    return 'Estimated.';
  }

  if (items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    return 'Restaurant verified.';
  }

  if (items.every((item) => item.source_type === 'GENERIC_REFERENCE')) {
    return 'Generic reference.';
  }

  if (items.every((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback)) {
    return 'Estimated.';
  }

  if (items.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    return 'Mixed sources with restaurant verified items.';
  }

  return 'Mixed sources.';
}

function getPendingConfidenceScore(items: ParsedFoodItem[], fallback: number | null | undefined) {
  if (!items.length) {
    return fallback ?? 0.82;
  }
  if (items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || item.is_trusted === false)) {
    return Math.min(fallback ?? 0.82, 0.82);
  }
  if (items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT' && item.is_trusted)) {
    return 0.95;
  }
  if (items.every((item) => item.is_trusted && item.source_type !== 'AI_ESTIMATE')) {
    return 0.9;
  }
  return fallback ?? 0.82;
}

function createPendingMealId(now: Date, displayTitle: string) {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return `pending-${random}`;
  }
  const slug = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'meal';
  return `pending-${now.getTime()}-${slug}`;
}

function tokenize(text: string) {
  const ignored = new Set(['a', 'an', 'the', 'and', 'with', 'to', 'that', 'it']);
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !ignored.has(token)),
  );
}

function itemSignature(items: ParsedFoodItem[]) {
  return items
    .map((item) => [
      item.food_name.trim().toLowerCase(),
      item.unit.trim().toLowerCase(),
      Number(item.quantity || 0).toFixed(3),
      Number(item.calories || 0).toFixed(1),
      Number(item.protein || 0).toFixed(1),
      Number(item.carbs || 0).toFixed(1),
      Number(item.fat || 0).toFixed(1),
    ].join(':'))
    .join('|');
}
