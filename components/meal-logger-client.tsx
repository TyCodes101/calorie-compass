'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  PencilLine,
  Plus,
  RotateCcw,
  SendHorizontal,
  Star,
  WifiOff,
  X,
} from 'lucide-react';

import type { MealAssistantContext, MealAssistantResponse, MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import {
  assistantMemoryStorageKey,
  createEmptyAssistantMemory,
  mergeAssistantMemorySnapshots,
  parseAssistantMemory,
  rememberAssistantCorrection,
  rememberAssistantMeal,
  type AssistantMemorySnapshot,
} from '@/lib/assistant-memory';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { TrustBadge } from '@/components/trust-badge';
import type { RecentMealQuickLog } from '@/lib/history';
import { detectLoggerCommand } from '@/lib/logger-intent';
import { type FavoriteMealSummary, type LoggerDraft } from '@/lib/reusable-meals';
import { getConfidenceCopy, getItemSourceLabel, getItemTrustPresentation, summarizeParsedItems } from '@/lib/trust';
import { useOnlineStatus } from '@/lib/use-online-status';

const mealTypeOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const;

const promptExamples = [
  'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
  '42g Fairlife shake',
  '3 scrambled eggs and 2 slices of toast',
];

type LocalAssistantAction =
  | { kind: 'none' }
  | { kind: 'barcode'; reply: string }
  | { kind: 'label'; reply: string }
  | { kind: 'voice'; reply: string }
  | { kind: 'photo'; reply: string };

type ActionKind = 'parse' | 'save' | 'favorite' | 'removeFavorite';

type QuickLogProps = {
  initialDraft?: LoggerDraft | null;
  favoriteMeals?: FavoriteMealSummary[];
  recentMeals?: RecentMealQuickLog[];
  seedAssistantMemory?: AssistantMemorySnapshot | null;
  nutritionPreferences?: string | null;
  userName?: string | null;
  proteinGoal?: number | null;
  dailyCalorieGoal?: number | null;
  todayProtein?: number | null;
  todayCarbs?: number | null;
  todayFat?: number | null;
  todayCalories?: number | null;
  remainingProtein?: number | null;
  remainingCarbs?: number | null;
  remainingFat?: number | null;
  remainingCalories?: number | null;
  todayMealCount?: number | null;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  tone?: 'default' | 'success' | 'warning';
  compact?: boolean;
};

type EntryMode = 'chat' | 'barcode' | 'label';

type NutritionLabelDraft = {
  name: string;
  servingQuantity: string;
  servingUnit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
};

type ParseRequestOptions = {
  text?: string;
  barcode?: string | null;
  nutritionLabel?: ReturnType<typeof buildNutritionLabelPayload> | null;
  mode?: 'new' | 'clarification' | 'correction';
  correctionText?: string | null;
};

function defaultNutritionLabelDraft(): NutritionLabelDraft {
  return {
    name: '',
    servingQuantity: '1',
    servingUnit: 'serving',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    sodium: '',
  };
}

function sumTotals(items: ParsedFoodItem[]) {
  return items.reduce(
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

function cleanPromptForReply(text: string) {
  return text
    .trim()
    .replace(/^i\s+(had|ate|drank)\s+/i, '')
    .replace(/^for\s+(breakfast|lunch|dinner|a snack),?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');
}

function shorten(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function sanitizeChatText(text: string) {
  return text
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u20ac\u201c/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-');
}

function buildMealReference(prompt: string, items: ParsedFoodItem[]) {
  if (items.length === 1) {
    return items[0]?.food_name ?? shorten(cleanPromptForReply(prompt) || 'that meal');
  }

  return shorten(cleanPromptForReply(prompt) || 'that meal');
}

function buildCorrectionReference(prompt: string, items: ParsedFoodItem[]) {
  if (items.length === 1) {
    const item = items[0];
    const quantityLabel = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1);
    return `${quantityLabel} ${item.food_name}`;
  }

  return buildMealReference(prompt, items);
}

function getUtcDayStamp(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getRecentMealDay(meal: RecentMealQuickLog) {
  return meal.date ?? meal.createdAt;
}

function getRecentLoggingStreak(recentMeals: RecentMealQuickLog[]) {
  const uniqueDays = Array.from(
    new Set(
      recentMeals
        .map((meal) => getUtcDayStamp(getRecentMealDay(meal)))
        .filter((value): value is number => value !== null),
    ),
  ).sort((left, right) => right - left);

  if (!uniqueDays.length) {
    return 0;
  }

  const today = new Date();
  const todayStamp = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const firstDay = uniqueDays[0];
  const normalizedDays = firstDay === todayStamp || firstDay === todayStamp - 86400000 ? uniqueDays : [todayStamp - 86400000, ...uniqueDays];

  let streak = 0;
  let expected = normalizedDays[0];

  for (const day of normalizedDays) {
    if (day !== expected) {
      break;
    }

    streak += 1;
    expected -= 86400000;
  }

  return streak;
}

function buildTrustSentence(items: ParsedFoodItem[], estimatedCount: number) {
  if (!items.length) {
    return 'You can tweak it before saving.';
  }

  if (items.some((item) => /using your last saved values/i.test(item.notes ?? ''))) {
    return 'I used your last saved version for it.';
  }

  if (items.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    return 'I found a restaurant match for it.';
  }

  if (estimatedCount === 0) {
    return 'I found a likely match for it.';
  }

  return 'This one looks estimated, so you can tweak it before saving.';
}

function normalizeMemoryKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(i|had|have|ate|drank|from|with|and|the|a|an|for|my|usual)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMemoryCue(prompt: string, favoriteMeals: FavoriteMealSummary[], recentMeals: RecentMealQuickLog[]) {
  const normalizedPrompt = normalizeMemoryKey(prompt);

  if (!normalizedPrompt) {
    return null;
  }

  const entries = [
    ...favoriteMeals.map((meal) => ({ title: meal.title, kind: 'favorite' as const })),
    ...recentMeals.map((meal) => ({ title: meal.title, kind: 'recent' as const })),
  ];

  const match = entries.find((entry) => {
    const normalizedTitle = normalizeMemoryKey(entry.title);
    if (!normalizedTitle) {
      return false;
    }

    return normalizedPrompt.includes(normalizedTitle) || normalizedTitle.includes(normalizedPrompt);
  });

  if (!match) {
    return null;
  }

  return match.kind === 'favorite' ? `Looks like one of your saved go-tos.` : `Looks similar to something you've logged recently.`;
}

function cleanMealShortcut(text: string | null | undefined) {
  return (text ?? '')
    .trim()
    .replace(/^i\s+(?:had|ate|drank)\s+/i, '')
    .replace(/^for\s+(?:breakfast|lunch|dinner|a snack),?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');
}

function buildShortcutPrompt(text: string | null | undefined) {
  const cleaned = cleanMealShortcut(text);

  if (!cleaned) {
    return 'same as usual';
  }

  const concise = cleaned.split(',')[0]?.trim() ?? cleaned;
  return `same ${concise}`;
}

function hashClientText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function chooseClientPhrase(seed: string, variants: string[]) {
  return variants[hashClientText(seed) % variants.length] ?? variants[0] ?? '';
}

function buildTypingCopy(message: string) {
  if (/\b(?:suggest|recommend|idea|lighter|healthier|sweet|dessert|snack)\b/i.test(message)) {
    return {
      title: 'Thinking this through',
      subtitle: 'Lining up something that fits the moment.',
    };
  }

  if (/\b(?:what about|how about|carbs?|fat|protein|compare|versus|vs\b)\b/i.test(message)) {
    return {
      title: 'Staying on that thread',
      subtitle: 'Using the current meal and conversation context.',
    };
  }

  if (/\b(?:same|usual|again|repeat|yesterday)\b/i.test(message)) {
    return {
      title: 'Pulling that back in',
      subtitle: 'Checking your recent go-tos and usual meals.',
    };
  }

  if (/\b(?:protein|calories|on track|tonight|snack)\b/i.test(message)) {
    return {
      title: 'Checking today so far',
      subtitle: 'Using your goals and what you’ve logged already.',
    };
  }

  return {
    title: 'Give me a second',
    subtitle: 'I’m checking the closest match.',
  };
}

function buildTypingSequence(message: string) {
  const first = buildTypingCopy(message);

  if (/\b(?:suggest|recommend|idea|lighter|healthier|sweet|dessert|snack)\b/i.test(message)) {
    return [
      first,
      { title: 'Still thinking', subtitle: 'Keeping it practical and easy to say yes to.' },
      { title: 'Almost there', subtitle: 'Landing on the option that fits best.' },
    ];
  }

  if (/\b(?:what about|how about|carbs?|fat|protein|compare|versus|vs\b)\b/i.test(message)) {
    return [
      first,
      { title: 'Still on it', subtitle: 'Holding the meal and today’s context together.' },
      { title: 'Almost there', subtitle: 'Making sure the answer stays on the same thread.' },
    ];
  }

  if (/\b(?:same|usual|again|repeat|yesterday)\b/i.test(message)) {
    return [
      first,
      { title: 'Checking your patterns', subtitle: 'Looking through your recent meals and usual picks.' },
      { title: 'Almost there', subtitle: 'Pulling back the closest match.' },
    ];
  }

  if (/\b(?:protein|calories|on track|tonight|snack)\b/i.test(message)) {
    return [
      first,
      { title: 'Still checking', subtitle: 'Using today’s goals and what you’ve logged so far.' },
      { title: 'Almost there', subtitle: 'Keeping the answer short and useful.' },
    ];
  }

  return [
    first,
    { title: 'Still on it', subtitle: 'Matching the meal and smoothing the details.' },
    { title: 'Almost there', subtitle: 'Getting this into a clean log.' },
  ];
}

function buildQuickSuggestions(args: {
  favoriteMeals: FavoriteMealSummary[];
  recentMeals: RecentMealQuickLog[];
  assistantMemory?: AssistantMemorySnapshot;
  remainingProtein?: number | null;
  remainingCalories?: number | null;
}) {
  const suggestions = [] as { id: string; label: string; prompt: string }[];
  const seen = new Set<string>();

  function pushSuggestion(label: string, prompt: string) {
    const key = `${label}:${prompt}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push({ id: key, label, prompt });
  }

  const favorite = args.favoriteMeals[0];
  const recent = args.recentMeals[0];
  const remembered = args.assistantMemory?.recurringMeals?.[0];
  const yesterdayMeal = args.recentMeals.find((meal) => {
    const createdAt = Date.parse(getRecentMealDay(meal));
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const candidate = new Date(createdAt);
    const candidateDay = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate());
    return Math.round((today - candidateDay) / 86400000) === 1;
  });

  if (favorite) {
    pushSuggestion(shorten(cleanMealShortcut(favorite.rawText ?? favorite.title) || 'Same as usual', 26), buildShortcutPrompt(favorite.rawText ?? favorite.title));
  }

  if (recent) {
    pushSuggestion(shorten(cleanMealShortcut(recent.rawText ?? recent.title) || 'Repeat recent', 26), buildShortcutPrompt(recent.rawText ?? recent.title));
  }

  if (remembered) {
    pushSuggestion(shorten(cleanMealShortcut(remembered.rawText ?? remembered.title) || 'Usual meal', 26), buildShortcutPrompt(remembered.rawText ?? remembered.title));
  }

  if (yesterdayMeal) {
    pushSuggestion('Repeat yesterday', `repeat yesterday${yesterdayMeal.mealType ? ` ${yesterdayMeal.mealType}` : ''}`.trim());
  }

  if (args.recentMeals.length >= 4) {
    pushSuggestion('Week check-in', "how's this week going?");
  }

  if (args.remainingProtein !== null && args.remainingProtein !== undefined) {
    pushSuggestion('Protein left?', 'how much protein do I have left?');
  }

  if (args.remainingCalories !== null && args.remainingCalories !== undefined) {
    pushSuggestion('Tonight idea', 'what should I eat tonight?');
  }

  return suggestions.slice(0, 4);
}


function formatGoalValue(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) {
    return 'Set after onboarding';
  }

  const rounded = Math.round(value);
  return `${rounded < 0 ? `+${Math.abs(rounded)}` : rounded}${suffix}`;
}

function buildLoggerSnapshot(args: {
  remainingCalories?: number | null;
  remainingProtein?: number | null;
  todayMealCount?: number | null;
}) {
  return [
    {
      label: args.remainingCalories !== null && args.remainingCalories !== undefined && args.remainingCalories < 0 ? 'Over target' : 'Calories left',
      value: formatGoalValue(args.remainingCalories, ''),
      detail: args.remainingCalories !== null && args.remainingCalories !== undefined && args.remainingCalories < 0 ? 'Still useful data' : 'For today',
    },
    {
      label: 'Protein left',
      value: formatGoalValue(args.remainingProtein, 'g'),
      detail: 'Toward your goal',
    },
    {
      label: 'Meals today',
      value: String(args.todayMealCount ?? 0),
      detail: 'Logged so far',
    },
  ];
}

function shouldShowStarterPanel(args: {
  itemsLength: number;
  entryMode: EntryMode;
  clarifyingQuestion: string | null;
  loading: boolean;
  chatHistoryLength: number;
}) {
  return args.itemsLength === 0 && args.entryMode === 'chat' && !args.clarifyingQuestion && !args.loading && args.chatHistoryLength <= 1;
}

function detectLocalAssistantAction(message: string): LocalAssistantAction {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return { kind: 'none' };
  }

  if ((/\b(?:scan|use|open|check)\b.*\bbarcode\b/i.test(normalized) || /^barcode\b/i.test(normalized)) && !/\d{8,}/.test(normalized)) {
    return {
      kind: 'barcode',
      reply: 'Barcode mode is open. Scan it or type the digits and I’ll check the packaged-food match first.',
    };
  }

  if (/\b(?:scan|use|open|read|enter)\b.*\b(?:nutrition label|label)\b/i.test(normalized) || /^nutrition label\b/i.test(normalized)) {
    return {
      kind: 'label',
      reply: 'Label mode is open. Drop in the numbers and I’ll turn it into a clean packaged-food entry.',
    };
  }

  if (/\b(?:voice|log by voice|voice log|speak instead|talk instead)\b/i.test(normalized)) {
    return {
      kind: 'voice',
      reply: 'Voice logging is next up. For now, just text it naturally and I’ll keep the flow moving.',
    };
  }

  if (/\b(?:photo|picture|image|camera|snap)\b/i.test(normalized) && /\b(?:meal|food|label|this)\b/i.test(normalized)) {
    return {
      kind: 'photo',
      reply: 'Photo logging is on deck. Right now, barcode or label gets you the closest packaged-food match.',
    };
  }

  return { kind: 'none' };
}

function waitForAssistantBeat(ms: number) {
  if (process.env.NODE_ENV === 'test' || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createChatMessage(role: ChatMessage['role'], text: string, options?: Pick<ChatMessage, 'tone' | 'compact'>): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: sanitizeChatText(text),
    tone: options?.tone ?? 'default',
    compact: options?.compact ?? role === 'assistant',
  };
}

function buildInitialAssistantMessage(options: {
  firstName?: string | null;
  editingMealId?: string | null;
  sourceReusableMealId?: string | null;
  recentMeals?: RecentMealQuickLog[];
  todayMealCount?: number | null;
}) {
  if (options.editingMealId) {
    return 'I pulled up that saved meal. Make any changes you want, then save it again.';
  }

  if (options.sourceReusableMealId) {
    return 'I pulled up that favorite. You can log it as-is or tweak it first.';
  }

  const streak = getRecentLoggingStreak(options.recentMeals ?? []);
  const intro = `Hey${options.firstName ? ` ${options.firstName}` : ''}, what'd you eat today?`;

  if ((options.todayMealCount ?? 0) >= 1) {
    return `${intro} You’re already checked in today, so we can just keep building from there.`;
  }

  if (streak >= 4) {
    return `${intro} You’ve been pretty steady lately, so let’s keep this one easy.`;
  }

  if ((options.recentMeals ?? []).length >= 4) {
    return `${intro} I can keep the week-level patterns light and helpful while you log.`;
  }

  return intro;
}

function buildInitialAssistantState(args: {
  initialDraft?: LoggerDraft | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  userName?: string | null;
}): MealAssistantState {
  return {
    currentMealItems: args.initialDraft?.items ?? [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: args.initialDraft?.mealType ?? args.mealType,
    userName: args.userName ?? null,
    currentMealText: args.initialDraft?.rawText ?? null,
    confidenceScore: args.initialDraft?.confidenceScore ?? 0.82,
    sourceReusableMealId: args.initialDraft?.sourceReusableMealId ?? null,
    editingMealId: args.initialDraft?.editingMealId ?? null,
  };
}

function buildManualItem(): ParsedFoodItem {
  return {
    food_name: 'Custom item',
    quantity: 1,
    unit: 'serving',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: 'Added manually before saving.',
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'Manual adjustment',
    catalog_food_id: null,
  };
}

function buildAssistantEstimateCopy({
  prompt,
  items,
  totalCalories,
  totalProtein,
  estimatedCount,
  mode,
  memoryCue,
}: {
  prompt: string;
  items: ParsedFoodItem[];
  totalCalories: number;
  totalProtein: number;
  estimatedCount: number;
  mode?: 'initial' | 'correction';
  memoryCue?: string | null;
}) {
  const mealReference = buildMealReference(prompt, items);
  const trustSentence = buildTrustSentence(items, estimatedCount);
  const proteinNote = totalProtein >= 20 ? ` with about ${Math.round(totalProtein)}g protein` : '';
  const cuePrefix = memoryCue ? `${memoryCue} ` : '';

  if (mode === 'correction') {
    return `Got you, I updated that to ${buildCorrectionReference(prompt, items)}. That's about ${Math.round(totalCalories)} calories total${proteinNote}. ${trustSentence}`;
  }

  if (/fairlife|core power|shake|protein shake/i.test(mealReference)) {
    return `${cuePrefix}That should be ${mealReference}. I've got it around ${Math.round(totalCalories)} calories${proteinNote}. ${trustSentence}`;
  }

  return `${cuePrefix}Got it, that looks like ${mealReference}. I've got it around ${Math.round(totalCalories)} calories${proteinNote}. ${trustSentence}`;
}

function parseNonNegativeNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function buildBarcodePrompt(barcode: string) {
  return `Packaged food barcode ${barcode}`;
}

function buildNutritionLabelPrompt(label: NutritionLabelDraft) {
  const name = label.name.trim() || 'Packaged food';
  const calories = parseNonNegativeNumber(label.calories);
  const protein = parseNonNegativeNumber(label.protein);

  return `${name} nutrition label${calories !== null ? `, ${Math.round(calories)} calories` : ''}${protein !== null ? `, ${protein}g protein` : ''}`;
}

function buildNutritionLabelPayload(label: NutritionLabelDraft) {
  const calories = parseNonNegativeNumber(label.calories);

  if (calories === null) {
    return null;
  }

  return {
    name: label.name.trim() || null,
    servingQuantity: parseNonNegativeNumber(label.servingQuantity) ?? 1,
    servingUnit: label.servingUnit.trim() || 'serving',
    calories,
    protein: parseNonNegativeNumber(label.protein),
    carbs: parseNonNegativeNumber(label.carbs),
    fat: parseNonNegativeNumber(label.fat),
    fiber: parseNonNegativeNumber(label.fiber),
    sugar: parseNonNegativeNumber(label.sugar),
    sodium: parseNonNegativeNumber(label.sodium),
  };
}

function getDefaultMealType() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return 'breakfast' as const;
  }

  if (hour >= 11 && hour < 16) {
    return 'lunch' as const;
  }

  if (hour >= 16 && hour < 22) {
    return 'dinner' as const;
  }

  return 'snack' as const;
}

function ChatBubble({
  role,
  children,
  compact = false,
  tone = 'default',
}: {
  role: 'assistant' | 'user';
  children: React.ReactNode;
  compact?: boolean;
  tone?: 'default' | 'warning' | 'success';
}) {
  return (
    <div className={clsx('flex w-full', role === 'user' ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'chat-bubble max-w-[90%] rounded-[22px] px-3.5 py-2.75 sm:max-w-[82%]',
          compact && 'px-3 py-2.25',
          role === 'assistant' && tone === 'default' && 'chat-bubble-assistant',
          role === 'assistant' && tone === 'warning' && 'chat-bubble-assistant-warning',
          role === 'assistant' && tone === 'success' && 'border border-emerald-200 bg-emerald-50 text-emerald-900',
          role === 'user' && 'chat-bubble-user',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function TypingBubble({ title = 'Give me a second', subtitle = 'I’m checking the closest match.' }: { title?: string; subtitle?: string }) {
  return (
    <ChatBubble role="assistant" compact>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <div className="chat-typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </ChatBubble>
  );
}

export function MealLoggerClient({
  initialDraft = null,
  favoriteMeals = [],
  recentMeals = [],
  seedAssistantMemory = null,
  nutritionPreferences = null,
  userName = null,
  proteinGoal = null,
  dailyCalorieGoal = null,
  todayProtein = null,
  todayCarbs = null,
  todayFat = null,
  todayCalories = null,
  remainingProtein = null,
  remainingCarbs = null,
  remainingFat = null,
  remainingCalories = null,
  todayMealCount = null,
}: QuickLogProps) {
  const router = useRouter();
  const firstName = userName?.trim()?.split(/\s+/)[0] ?? null;
  const initialMealType = initialDraft?.mealType ?? getDefaultMealType();
  const [entryMode, setEntryMode] = useState<EntryMode>('chat');
  const [composerText, setComposerText] = useState(initialDraft?.items?.length ? '' : initialDraft?.rawText ?? '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [nutritionLabelDraft, setNutritionLabelDraft] = useState<NutritionLabelDraft>(() => defaultNutritionLabelDraft());
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => initialMealType);
  const [activePrompt, setActivePrompt] = useState(initialDraft?.rawText ?? '');
  const [displayUserMessage, setDisplayUserMessage] = useState(initialDraft?.rawText ?? '');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() =>
    initialDraft?.rawText
      ? [
          createChatMessage('assistant', buildInitialAssistantMessage({ firstName, editingMealId: initialDraft?.editingMealId ?? null, sourceReusableMealId: initialDraft?.sourceReusableMealId ?? null, recentMeals, todayMealCount })),
          createChatMessage('user', initialDraft.rawText, { compact: false }),
        ]
      : [createChatMessage('assistant', buildInitialAssistantMessage({ firstName, editingMealId: initialDraft?.editingMealId ?? null, sourceReusableMealId: initialDraft?.sourceReusableMealId ?? null, recentMeals, todayMealCount }))],
  );
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedFoodItem[]>(initialDraft?.items ?? []);
  const [confidenceScore, setConfidenceScore] = useState(initialDraft?.confidenceScore ?? 0.82);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ActionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteState, setFavoriteState] = useState<'idle' | 'saved' | 'dirty'>(initialDraft?.sourceReusableMealId ? 'saved' : 'idle');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceReusableMealId, setSourceReusableMealId] = useState<string | null>(initialDraft?.sourceReusableMealId ?? null);
  const [editingMealId, setEditingMealId] = useState<string | null>(initialDraft?.editingMealId ?? null);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasSavedCurrentDraft, setHasSavedCurrentDraft] = useState(false);
  const [lastParseOptions, setLastParseOptions] = useState<ParseRequestOptions | null>(null);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [assistantEstimateMode, setAssistantEstimateMode] = useState<'initial' | 'correction'>('initial');
  const [assistantState, setAssistantState] = useState<MealAssistantState>(() =>
    buildInitialAssistantState({
      initialDraft,
      mealType: initialMealType,
      userName,
    }),
  );
  const [assistantMemory, setAssistantMemory] = useState<AssistantMemorySnapshot>(() => {
    const localMemory = typeof window === 'undefined'
      ? createEmptyAssistantMemory()
      : parseAssistantMemory(window.localStorage.getItem(assistantMemoryStorageKey));

    return mergeAssistantMemorySnapshots(localMemory, seedAssistantMemory);
  });
  const [typingCopy, setTypingCopy] = useState(() => buildTypingCopy(initialDraft?.rawText ?? ''));
  const isOnline = useOnlineStatus();

  const totals = useMemo(() => sumTotals(items), [items]);
  const trustSummary = useMemo(() => summarizeParsedItems(items), [items]);
  const confidence = getConfidenceCopy(confidenceScore);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const canSaveMeal = items.length > 0 && !saving && isOnline && !hasSavedCurrentDraft;
  const canSaveFavorite = items.length > 0 && !favoriteSaving && !(sourceReusableMealId && favoriteState === 'saved') && isOnline;
  const canSend = composerText.trim().length > 0 && !loading && isOnline;
  const canLookupBarcode = barcodeInput.replace(/\D/g, '').length >= 8 && !loading && isOnline;
  const conversationPrompt = displayUserMessage || activePrompt;
  const memoryCue = useMemo(() => buildMemoryCue(conversationPrompt, favoriteMeals, recentMeals), [conversationPrompt, favoriteMeals, recentMeals]);
  const quickSuggestions = useMemo(
    () =>
      buildQuickSuggestions({
        favoriteMeals,
        recentMeals,
        assistantMemory,
        remainingProtein,
        remainingCalories,
      }),
    [assistantMemory, favoriteMeals, recentMeals, remainingProtein, remainingCalories],
  );
  const loggerSnapshot = useMemo(
    () => buildLoggerSnapshot({ remainingCalories, remainingProtein, todayMealCount }),
    [remainingCalories, remainingProtein, todayMealCount],
  );
  const showStarterPanel = shouldShowStarterPanel({
    itemsLength: items.length,
    entryMode,
    clarifyingQuestion,
    loading,
    chatHistoryLength: chatHistory.length,
  });
  const conversationLabel = useMemo(() => {
    switch (assistantState.activeMode) {
      case 'meal_building':
        return 'Building meal';
      case 'correction_mode':
        return 'Updating meal';
      case 'nutrition_coaching':
        return 'Nutrition coach';
      case 'macro_discussion':
        return 'Macro chat';
      case 'recommendation_mode':
        return 'Ideas';
      case 'review_save':
        return 'Review';
      default:
        return 'Assistant';
    }
  }, [assistantState.activeMode]);
  const compactComposerHint = clarifyingQuestion
    ? 'Short answer is enough.'
    : entryMode === 'barcode'
      ? 'Barcode open.'
      : entryMode === 'label'
        ? 'Label entry open.'
        : assistantState.activeMode === 'recommendation_mode'
          ? 'Ask for ideas naturally.'
          : 'Talk naturally.';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(assistantMemoryStorageKey, JSON.stringify(assistantMemory));
  }, [assistantMemory]);

  useEffect(() => {
    if (!composerRef.current) {
      return;
    }

    composerRef.current.style.height = '0px';
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 160)}px`;
  }, [composerText]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, clarifyingQuestion, items, loading, error, saveMessage, expandedIndex, entryMode, utilityMenuOpen]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const sequence = buildTypingSequence(lastAssistantMessage ?? activePrompt ?? '');

    if (sequence.length <= 1 || process.env.NODE_ENV === 'test') {
      return;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, sequence.length - 1);
      setTypingCopy(sequence[index] ?? sequence[sequence.length - 1] ?? buildTypingCopy(lastAssistantMessage ?? activePrompt ?? ''));
    }, 850);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading, lastAssistantMessage, activePrompt]);

  function appendChatMessage(role: ChatMessage['role'], text: string, options?: Pick<ChatMessage, 'tone' | 'compact'>) {
    const trimmed = sanitizeChatText(text).trim();

    if (!trimmed) {
      return;
    }

    setChatHistory((current) => {
      const previous = current[current.length - 1];

      if (role === 'assistant' && previous?.role === 'assistant' && previous.text.trim() === trimmed) {
        return current;
      }

      return [...current, createChatMessage(role, trimmed, options)];
    });
  }

  function clearFeedback() {
    setError(null);
    setErrorAction(null);
    setSaveMessage(null);
  }

  function markDraftChanged() {
    clearFeedback();
    setHasSavedCurrentDraft(false);
    setAssistantState((current) => ({
      ...current,
      saved: false,
    }));

    if (sourceReusableMealId) {
      setFavoriteState((current) => (current === 'saved' ? 'dirty' : current));
    }
  }

  function buildAssistantRequestState(): MealAssistantState {
    return {
      ...assistantState,
      currentMealItems: items,
      mealType,
      userName: assistantState.userName ?? userName ?? null,
      confidenceScore,
      sourceReusableMealId,
      editingMealId,
    };
  }

  function buildAssistantRequestContext(): MealAssistantContext {
    return {
      favoriteMeals: favoriteMeals.map((meal) => ({
        id: meal.id,
        title: meal.title,
        rawText: meal.rawText ?? null,
        mealType: meal.mealType,
        totalCalories: meal.totalCalories,
        confidenceScore: meal.confidenceScore ?? 0.92,
        sourceReusableMealId: meal.id,
        lastUsedAt: meal.lastUsedAt ?? null,
        items: meal.items ?? [],
      })),
      recentMeals: recentMeals.map((meal) => ({
        id: meal.id,
        title: meal.title,
        rawText: meal.rawText ?? null,
        mealType: meal.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        totalCalories: meal.totalCalories,
        confidenceScore: meal.confidenceScore ?? 0.82,
        date: meal.date,
        createdAt: meal.createdAt,
        items: meal.items,
      })),
      assistantMemory,
      nutritionPreferences,
      proteinGoal,
      dailyCalorieGoal,
      todayProtein,
      todayCarbs,
      todayFat,
      todayCalories,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      remainingCalories,
      todayMealCount,
    };
  }

  function buildAssistantConversationHistory(nextUserMessage: string) {
    return [
      ...chatHistory.slice(-11).map((message) => ({
        role: message.role,
        text: message.text,
      })),
      {
        role: 'user' as const,
        text: nextUserMessage,
      },
    ];
  }

  function rememberMealLocally(options?: {
    title?: string | null;
    rawText?: string | null;
    itemsOverride?: ParsedFoodItem[];
    mealTypeOverride?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    confidenceOverride?: number | null;
    source?: 'saved' | 'favorite' | 'recent' | 'draft';
  }) {
    const nextItems = options?.itemsOverride ?? items;
    if (!nextItems.length) {
      return;
    }

    setAssistantMemory((current) =>
      rememberAssistantMeal(current, {
        title: options?.title?.trim() || activePrompt || displayUserMessage || buildMealReference(activePrompt || displayUserMessage || 'meal', nextItems),
        rawText: options?.rawText ?? activePrompt ?? displayUserMessage ?? null,
        mealType: options?.mealTypeOverride ?? mealType,
        items: nextItems,
        confidenceScore: options?.confidenceOverride ?? confidenceScore,
        source: options?.source ?? 'saved',
      }),
    );
  }

  function rememberCorrectionLocally(text: string) {
    setAssistantMemory((current) => rememberAssistantCorrection(current, text));
  }

  function applyAssistantResponse(response: MealAssistantResponse, message: string) {
    setAssistantState(response.next_state);
    setMealType(response.next_state.mealType);
    setItems(response.meal.items);
    setConfidenceScore(response.meal.confidence_score);
    setClarifyingQuestion(response.clarification_question);
    setExpandedIndex(null);
    setEntryMode('chat');
    setBarcodeInput('');
    setNutritionLabelDraft(defaultNutritionLabelDraft());
    setUtilityMenuOpen(false);
    setComposerText('');
    setActivePrompt(response.next_state.currentMealText ?? '');
    setDisplayUserMessage(response.next_state.currentMealText ?? (response.meal.items.length ? message : ''));
    setSourceReusableMealId(response.next_state.sourceReusableMealId ?? null);
    setEditingMealId(response.next_state.editingMealId ?? null);
    setFavoriteState(response.next_state.sourceReusableMealId ? 'saved' : 'idle');
    setAssistantEstimateMode(
      response.intent === 'correction' || response.intent === 'quantity_change' || response.intent === 'remove_item'
        ? 'correction'
        : 'initial',
    );

    if (response.next_state.saved) {
      setHasSavedCurrentDraft(true);
      setSaveMessage('saved');
      router.refresh();
    } else {
      setHasSavedCurrentDraft(false);
      setSaveMessage(null);
    }

    if (
      response.next_state.sourceReusableMealId &&
      ['new_food_item', 'add_to_current_meal', 'correction', 'quantity_change', 'remove_item', 'clarification_answer'].includes(response.intent)
    ) {
      setFavoriteState((current) => (current === 'saved' ? 'dirty' : current));
    }

    if (['correction', 'quantity_change', 'remove_item', 'clarification_answer'].includes(response.intent)) {
      rememberCorrectionLocally(message);
    }

    if (response.intent === 'repeat_meal' && response.meal.items.length) {
      rememberMealLocally({
        title: response.next_state.currentMealText,
        rawText: response.next_state.currentMealText,
        itemsOverride: response.meal.items,
        mealTypeOverride: response.next_state.mealType,
        confidenceOverride: response.meal.confidence_score,
        source: 'recent',
      });
    }
  }

  function resetDraft(options?: { preserveThread?: boolean }) {
    clearFeedback();
    setEntryMode('chat');
    setComposerText('');
    setBarcodeInput('');
    setNutritionLabelDraft(defaultNutritionLabelDraft());
    setActivePrompt('');
    setDisplayUserMessage('');
    setItems([]);
    setClarifyingQuestion(null);
    setExpandedIndex(null);
    setSourceReusableMealId(null);
    setFavoriteState('idle');
    setEditingMealId(null);
    setUtilityMenuOpen(false);
    setHasSavedCurrentDraft(false);
    setLastParseOptions(null);
    setLastAssistantMessage(null);
    setAssistantEstimateMode('initial');
    setAssistantState({
      currentMealItems: [],
      pendingClarification: null,
      lastAssistantQuestion: null,
      userCorrections: [],
      saved: false,
      mealType,
      userName: userName ?? null,
      currentMealText: null,
      confidenceScore: 0.82,
      sourceReusableMealId: null,
      editingMealId: null,
    });
    if (!options?.preserveThread) {
      setChatHistory([createChatMessage('assistant', buildInitialAssistantMessage({ firstName, recentMeals, todayMealCount }))]);
    }
  }

  function startAnotherMeal(message = 'Ready for the next one. What’d you eat?') {
    resetDraft({ preserveThread: true });
    appendChatMessage('assistant', message, { compact: true });
  }

  function addManualItem() {
    const nextIndex = items.length;
    const nextItems = [...items, buildManualItem()];
    markDraftChanged();
    setItems(nextItems);
    setAssistantState((current) => ({
      ...current,
      currentMealItems: nextItems,
      mealType,
      confidenceScore,
      sourceReusableMealId,
      editingMealId,
    }));
    setExpandedIndex(nextIndex);
    appendChatMessage('assistant', 'I added a custom item. Fill in what looks right and I’ll keep the rest in place.', { compact: true });
  }

  function loadRecentMealIntoDraft(meal: RecentMealQuickLog, triggerText?: string) {
    clearFeedback();
    setEntryMode('chat');
    setComposerText('');
    setBarcodeInput('');
    setNutritionLabelDraft(defaultNutritionLabelDraft());
    setMealType((meal.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? getDefaultMealType());
    setActivePrompt(meal.rawText?.trim() || meal.title);
    setDisplayUserMessage(meal.rawText?.trim() || meal.title);
    setItems(meal.items);
    setConfidenceScore(meal.confidenceScore ?? 0.82);
    setClarifyingQuestion(null);
    setExpandedIndex(null);
    setSourceReusableMealId(null);
    setFavoriteState('idle');
    setEditingMealId(null);
    setUtilityMenuOpen(false);
    setHasSavedCurrentDraft(false);
    setLastParseOptions(null);
    setLastAssistantMessage(null);
    setAssistantEstimateMode('initial');
    setSaveMessage(null);
    setAssistantState({
      currentMealItems: meal.items,
      pendingClarification: null,
      lastAssistantQuestion: null,
      userCorrections: [],
      saved: false,
      mealType: (meal.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? getDefaultMealType(),
      userName: userName ?? null,
      currentMealText: meal.rawText?.trim() || meal.title,
      confidenceScore: meal.confidenceScore ?? 0.82,
      sourceReusableMealId: null,
      editingMealId: null,
    });

    if (triggerText) {
      appendChatMessage('user', triggerText, { compact: true });
    }

    appendChatMessage('assistant', `Got it, I loaded ${meal.title} again. I’ll keep it here so you can save it or tweak it first.`);
    rememberMealLocally({
      title: meal.title,
      rawText: meal.rawText,
      itemsOverride: meal.items,
      mealTypeOverride: (meal.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? getDefaultMealType(),
      confidenceOverride: meal.confidenceScore ?? 0.82,
      source: 'recent',
    });
  }

  async function sendAssistantMessage(message: string, options?: { retry?: boolean }) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    const localAction = detectLocalAssistantAction(trimmedMessage);
    if (localAction.kind !== 'none') {
      clearFeedback();
      setUtilityMenuOpen(false);
      setLastAssistantMessage(trimmedMessage);

      if (!options?.retry) {
        appendChatMessage('user', trimmedMessage, { compact: items.length > 0 || Boolean(clarifyingQuestion) });
        setComposerText('');
      }

      if (localAction.kind === 'barcode') {
        openEntryMode('barcode');
      } else if (localAction.kind === 'label') {
        openEntryMode('label');
      } else {
        setEntryMode('chat');
      }

      setAssistantState((current) => ({
        ...current,
        activeTopic: localAction.kind === 'voice' || localAction.kind === 'photo' ? 'casual' : 'meal',
        activeMode: localAction.kind === 'voice' || localAction.kind === 'photo' ? 'casual_conversation' : 'logging_mode',
        activeQuestion: trimmedMessage,
        previousIntent: 'casual_message',
        previousUserMessage: trimmedMessage,
        lastAssistantReply: localAction.reply,
      }));
      appendChatMessage('assistant', localAction.reply, { compact: true });
      return;
    }

    if (!isOnline) {
      setError('You appear to be offline. Reconnect to update this meal.');
      setErrorAction('parse');
      return;
    }

    const startedAt = Date.now();
    setTypingCopy(buildTypingCopy(trimmedMessage));
    setLoading(true);
    setError(null);
    setErrorAction(null);
    setSaveMessage(null);
    setLastParseOptions(null);
    setLastAssistantMessage(trimmedMessage);
    setUtilityMenuOpen(false);

    if (!options?.retry) {
      appendChatMessage('user', trimmedMessage, { compact: items.length > 0 || Boolean(clarifyingQuestion) });
      setComposerText('');
    }

    try {
      const response = await fetch('/api/meal-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          state: buildAssistantRequestState(),
          context: buildAssistantRequestContext(),
          conversationHistory: buildAssistantConversationHistory(trimmedMessage),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We could not update that meal right now. Please try again.');
        setErrorAction('parse');
        return;
      }

      const assistantResponse = data as MealAssistantResponse;
      const elapsed = Date.now() - startedAt;
      const minimumDelay = Math.min(720, Math.max(220, trimmedMessage.split(/\s+/).length * 36));
      await waitForAssistantBeat(minimumDelay - elapsed);
      applyAssistantResponse(assistantResponse, trimmedMessage);
      appendChatMessage('assistant', assistantResponse.assistant_reply, {
        compact: assistantResponse.meal.items.length === 0 && !assistantResponse.next_state.saved,
        tone: assistantResponse.next_state.saved ? 'success' : 'default',
      });
    } catch {
      setError('We could not update that meal right now. Please try again.');
      setErrorAction('parse');
    } finally {
      setLoading(false);
    }
  }

  async function parseMeal(options?: ParseRequestOptions) {
    const isDirectPackageInput = Boolean(options?.barcode || options?.nutritionLabel);
    const mode = options?.mode ?? (clarifyingQuestion && !isDirectPackageInput ? 'clarification' : 'new');
    const isClarification = mode === 'clarification';
    const isCorrection = mode === 'correction';
    const nextInput = (options?.text ?? composerText).trim();
    const prompt = isClarification ? activePrompt.trim() : nextInput;

    if (loading || !prompt) {
      return;
    }

    if (!isOnline) {
      setError('You appear to be offline. Reconnect to estimate this meal.');
      setErrorAction('parse');
      return;
    }

    if (isClarification && !nextInput) {
      return;
    }

    setLoading(true);
    setError(null);
    setErrorAction(null);
    setSaveMessage(null);
    setLastParseOptions(options ?? null);
    setLastAssistantMessage(null);
    setUtilityMenuOpen(false);

    const fullText = isClarification ? `${prompt}\nAdditional detail: ${nextInput}` : isCorrection ? nextInput : prompt;

    if (!isDirectPackageInput && nextInput) {
      appendChatMessage('user', nextInput, { compact: mode !== 'new' });
    }

    if (!isClarification && !isCorrection) {
      setActivePrompt(prompt);
      setDisplayUserMessage(prompt);
    }

    try {
      const response = await fetch('/api/ai/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          mealType,
          barcode: options?.barcode ?? undefined,
          nutritionLabel: options?.nutritionLabel ?? undefined,
          conversation:
            isCorrection || isClarification
              ? {
                  mode,
                  previousMealText: activePrompt || null,
                  correctionText: isCorrection ? options?.correctionText ?? nextInput : null,
                  currentItems: items,
                }
              : undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We could not estimate that meal right now. Please try again.');
        setErrorAction('parse');
        return;
      }

      const parsed = data as ParsedMealResponse;
      setConfidenceScore(parsed.confidence_score);
      setHasSavedCurrentDraft(false);

      if (parsed.needs_clarification) {
        const nextClarifyingQuestion = parsed.clarifying_question ?? 'I just need one quick detail to tighten that up.';
        setClarifyingQuestion(nextClarifyingQuestion);
        setItems([]);
        setExpandedIndex(null);
        setComposerText('');
        setAssistantEstimateMode('initial');
        setAssistantState((current) => ({
          ...current,
          currentMealItems: [],
          pendingClarification: nextClarifyingQuestion,
          lastAssistantQuestion: nextClarifyingQuestion,
          saved: false,
          mealType,
          userName: current.userName ?? userName ?? null,
          currentMealText: prompt,
          confidenceScore: parsed.confidence_score,
          sourceReusableMealId,
          editingMealId,
        }));
        appendChatMessage('assistant', nextClarifyingQuestion, { compact: true });
        return;
      }

      if (!parsed.items.length) {
        setError('We could not estimate that meal right now. Please try again.');
        setErrorAction('parse');
        return;
      }

      if (sourceReusableMealId) {
        setFavoriteState('dirty');
      }

      if (isClarification) {
        setActivePrompt(fullText.trim());
      }

      setClarifyingQuestion(null);
      setItems(parsed.items);
      setExpandedIndex(null);
      setEntryMode('chat');
      setBarcodeInput('');
      setNutritionLabelDraft(defaultNutritionLabelDraft());
      setComposerText('');
      setAssistantEstimateMode(isCorrection ? 'correction' : 'initial');
      setAssistantState((current) => ({
        ...current,
        currentMealItems: parsed.items,
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: false,
        mealType,
        userName: current.userName ?? userName ?? null,
        currentMealText: isCorrection ? `${activePrompt}\nCorrection: ${nextInput}`.trim() : fullText.trim(),
        confidenceScore: parsed.confidence_score,
        sourceReusableMealId,
        editingMealId,
      }));

      appendChatMessage(
        'assistant',
        buildAssistantEstimateCopy({
          prompt: isCorrection ? activePrompt || prompt : prompt,
          items: parsed.items,
          totalCalories: sumTotals(parsed.items).calories,
          totalProtein: sumTotals(parsed.items).protein,
          estimatedCount: summarizeParsedItems(parsed.items).estimatedCount,
          mode: isCorrection ? 'correction' : 'initial',
          memoryCue: buildMemoryCue(prompt, favoriteMeals, recentMeals),
        }),
      );

      if (isCorrection) {
        setActivePrompt(`${activePrompt}\nCorrection: ${nextInput}`.trim());
      }
    } catch {
      setError('We could not estimate that meal right now. Please try again.');
      setErrorAction('parse');
    } finally {
      setLoading(false);
    }
  }

  function updateNutritionLabelField(field: keyof NutritionLabelDraft, value: string) {
    setNutritionLabelDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openEntryMode(mode: EntryMode) {
    if (chatHistory.length > 1 || items.length || clarifyingQuestion || saveMessage) {
      resetDraft({ preserveThread: true });
    }

    clearFeedback();
    setEntryMode(mode);
    setUtilityMenuOpen(false);
  }

  function closeEntryMode() {
    setEntryMode('chat');
    setUtilityMenuOpen(false);
  }

  async function lookupBarcode() {
    const barcode = barcodeInput.replace(/\D/g, '');

    if (!barcode || barcode.length < 8 || barcode.length > 14) {
      setError('Enter the 8 to 14 digits under the barcode so I can look it up.');
      setErrorAction(null);
      return;
    }

    await parseMeal({
      text: buildBarcodePrompt(barcode),
      barcode,
    });
  }

  async function useNutritionLabel() {
    const nutritionLabel = buildNutritionLabelPayload(nutritionLabelDraft);

    if (!nutritionLabel) {
      setError('Add at least the calories from the label so I can build the item.');
      setErrorAction(null);
      return;
    }

    await parseMeal({
      text: buildNutritionLabelPrompt(nutritionLabelDraft),
      nutritionLabel,
    });
  }

  async function saveMeal() {
    if (!canSaveMeal) {
      if (!isOnline) {
        setError('You appear to be offline. Reconnect to save this meal.');
        setErrorAction('save');
      }
      return;
    }

    setSaving(true);
    setError(null);
    setErrorAction(null);
    setSaveMessage(null);

    try {
      const endpoint = editingMealId ? `/api/meals/${editingMealId}` : '/api/meals';
      const method = editingMealId ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          confidence_score: confidenceScore,
          raw_text: activePrompt,
          source_reusable_meal_id: sourceReusableMealId,
          items,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We couldn’t save your meal right now. Please try again.');
        setErrorAction('save');
        setSaving(false);
        return;
      }

      await waitForAssistantBeat(180);
      const saveReply = editingMealId
        ? chooseClientPhrase(`save:update:${activePrompt}:${items.length}`, ['Saved the update.', 'Alright, that update is saved.', 'Done, I saved the changes.'])
        : chooseClientPhrase(`save:new:${activePrompt}:${items.length}`, ['Saved it. Want to log anything else?', 'All set, that one is logged.', 'Got it saved. Want to keep going?']);
      setSaving(false);
      setHasSavedCurrentDraft(true);
      setSaveMessage(saveReply);
      setAssistantState((current) => ({
        ...current,
        currentMealItems: items,
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: true,
        mealType,
        userName: current.userName ?? userName ?? null,
        currentMealText: activePrompt || current.currentMealText,
        confidenceScore,
        sourceReusableMealId,
        editingMealId,
      }));
      rememberMealLocally({ source: 'saved' });
      appendChatMessage('assistant', saveReply, { tone: 'success' });
      router.refresh();
    } catch {
      setSaving(false);
      setError('We couldn’t save your meal right now. Please try again.');
      setErrorAction('save');
    }
  }

  async function saveFavorite() {
    if (!canSaveFavorite) {
      if (!isOnline) {
        setError('You appear to be offline. Reconnect to save this favorite.');
        setErrorAction('favorite');
      }
      return;
    }

    setFavoriteSaving(true);
    setError(null);
    setErrorAction(null);

    try {
      const response = await fetch('/api/reusable-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reusable_meal_id: sourceReusableMealId,
          meal_type: mealType,
          confidence_score: confidenceScore,
          raw_text: activePrompt,
          items,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We couldn’t save your favorite right now. Please try again.');
        setErrorAction('favorite');
        setFavoriteSaving(false);
        return;
      }

      await waitForAssistantBeat(150);
      const nextReusableMealId = data?.favoriteMeal?.id ?? sourceReusableMealId;
      const favoriteReply = sourceReusableMealId
        ? chooseClientPhrase(`favorite:update:${activePrompt}:${items.length}`, ['Updated your favorite.', 'Alright, I refreshed that favorite.', 'Done, your favorite is updated.'])
        : chooseClientPhrase(`favorite:new:${activePrompt}:${items.length}`, ['Saved that as a favorite.', 'Nice, I saved that to your favorites.', 'Alright, that one is in favorites now.']);
      setSourceReusableMealId(nextReusableMealId);
      setAssistantState((current) => ({
        ...current,
        sourceReusableMealId: nextReusableMealId,
      }));
      rememberMealLocally({ source: 'favorite' });
      setFavoriteState('saved');
      setFavoriteSaving(false);
      appendChatMessage('assistant', favoriteReply, { tone: 'success' });
      router.refresh();
    } catch {
      setFavoriteSaving(false);
      setError('We couldn’t save your favorite right now. Please try again.');
      setErrorAction('favorite');
    }
  }

  async function removeFavorite() {
    if (!sourceReusableMealId || favoriteSaving) {
      return;
    }

    if (!isOnline) {
      setError('You appear to be offline. Reconnect to remove this favorite.');
      setErrorAction('removeFavorite');
      return;
    }

    setFavoriteSaving(true);
    setError(null);
    setErrorAction(null);

    try {
      const response = await fetch(`/api/reusable-meals/${sourceReusableMealId}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We couldn’t remove that favorite right now. Please try again.');
        setErrorAction('removeFavorite');
        setFavoriteSaving(false);
        return;
      }

      await waitForAssistantBeat(120);
      const removeFavoriteReply = chooseClientPhrase(`favorite:remove:${activePrompt}:${items.length}`, [
        'Removed the favorite. The meal is still here if you want it.',
        'Okay, I took it out of favorites. The meal is still here.',
        'Favorite removed. I kept the meal in place in case you still want it.',
      ]);
      setSourceReusableMealId(null);
      setAssistantState((current) => ({
        ...current,
        sourceReusableMealId: null,
      }));
      setFavoriteState('idle');
      setFavoriteSaving(false);
      appendChatMessage('assistant', removeFavoriteReply, { tone: 'success' });
      router.refresh();
    } catch {
      setFavoriteSaving(false);
      setError('We couldn’t remove that favorite right now. Please try again.');
      setErrorAction('removeFavorite');
    }
  }

  function retryLastAction() {
    if (errorAction === 'parse') {
      if (lastAssistantMessage) {
        sendAssistantMessage(lastAssistantMessage, { retry: true });
        return;
      }

      parseMeal(lastParseOptions ?? undefined);
      return;
    }

    if (errorAction === 'save') {
      saveMeal();
      return;
    }

    if (errorAction === 'favorite') {
      saveFavorite();
      return;
    }

    if (errorAction === 'removeFavorite') {
      removeFavorite();
    }
  }

  function updateItem(index: number, key: keyof ParsedFoodItem, value: string | number | null) {
    markDraftChanged();
    const nextItems = items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      const isText = ['food_name', 'unit', 'notes', 'source_name', 'source_type', 'catalog_food_id'].includes(key);
      return {
        ...item,
        [key]: isText ? value : Number(value),
      };
    });
    setItems(nextItems);
    setAssistantState((current) => ({
      ...current,
      currentMealItems: nextItems,
      mealType,
      confidenceScore,
      sourceReusableMealId,
      editingMealId,
    }));
  }

  function removeItem(index: number) {
    markDraftChanged();
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    setItems(nextItems);
    setAssistantState((current) => ({
      ...current,
      currentMealItems: nextItems,
      mealType,
      confidenceScore,
      sourceReusableMealId,
      editingMealId,
    }));
    setExpandedIndex((current) => (current === index ? null : current));
  }

  function submitComposer() {
    const message = composerText.trim();
    const hasActiveMeal = items.length > 0;

    if (!message || loading) {
      return;
    }

    const command = detectLoggerCommand(message, {
      hasActiveMeal,
      hasFavorite: Boolean(sourceReusableMealId),
      hasRecentMeal: Boolean(recentMeals[0]),
    });

    if (command === 'repeat_last_meal' || command === 'favorite' || command === 'remove_favorite' || command === 'edit') {
      clearFeedback();
      appendChatMessage('user', message, { compact: hasActiveMeal || command === 'repeat_last_meal' });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (command === 'repeat_last_meal') {
        if (recentMeals[0]) {
          loadRecentMealIntoDraft(recentMeals[0]);
        } else {
          appendChatMessage('assistant', "I don't have a recent meal to repeat yet. Once you've logged one, I can pull it back in fast.");
        }
        return;
      }

      if (command === 'edit') {
        setExpandedIndex((current) => current ?? 0);
        appendChatMessage('assistant', 'Sure. You can tweak the items below, or just tell me what to change.');
        return;
      }

      if (command === 'favorite') {
        saveFavorite();
        return;
      }

      if (command === 'remove_favorite') {
        removeFavorite();
        return;
      }
    }

    sendAssistantMessage(message);
  }

  return (
    <div className="logger-assistant-screen app-page-chat flex min-w-0 flex-col py-3">
      <div className="logger-assistant-topbar app-screen">
        <Link href="/" aria-label="Back to dashboard" className="logger-topbar-button">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="logger-topbar-meta min-w-0">
          <p className="logger-topbar-title">{conversationLabel}</p>
          {assistantState.activeQuestion ? <p className="logger-topbar-subtitle truncate">{assistantState.activeQuestion}</p> : null}
        </div>
      </div>

      <section className="logger-assistant-thread-shell app-screen">
        <div className="logger-session-strip" aria-label="Today snapshot">
          {loggerSnapshot.map((item) => (
            <div key={item.label} className="logger-session-pill">
              <p className="logger-session-label">{item.label}</p>
              <p className="logger-session-value">{item.value}</p>
              <p className="logger-session-detail">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="chat-thread">
          {!isOnline ? (
            <ChatBubble role="assistant" tone="warning" compact>
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-sm font-medium text-slate-900">You’re offline right now.</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">You can still review meals, but estimating and saving need a connection.</p>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {chatHistory.map((message) => (
            <ChatBubble key={message.id} role={message.role} compact={message.compact} tone={message.tone === 'success' ? 'success' : message.tone === 'warning' ? 'warning' : 'default'}>
              <p className={clsx('text-sm leading-6', message.role === 'user' ? 'font-medium text-slate-950' : 'text-slate-700')}>{message.text}</p>
            </ChatBubble>
          ))}

          {showStarterPanel ? (
            <ChatBubble role="assistant" compact>
              <div className="logger-starter-panel">
                <div className="logger-starter-hero">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Log like you’d text a coach</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Give me a messy meal, a branded food, or a partial serving. I’ll turn it into reviewable nutrition with sources before anything saves.</p>
                  </div>
                  <div className="logger-starter-proof" aria-label="AI product capabilities">
                    <span>Understands corrections</span>
                    <span>Handles restaurants</span>
                    <span>Remembers repeats</span>
                  </div>
                </div>
                <div className="logger-demo-card" aria-label="Sample interaction">
                  <div className="logger-demo-user">half a Chipotle chicken bowl and a Fairlife shake</div>
                  <div className="logger-demo-assistant">I’ll split the bowl serving, keep the branded shake separate, and show confidence before you save.</div>
                </div>
                <div className="logger-starter-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setComposerText(promptExamples[0]);
                      setUtilityMenuOpen(false);
                      composerRef.current?.focus();
                    }}
                    className="logger-starter-action"
                  >
                    Try example
                  </button>
                  <button type="button" onClick={() => openEntryMode('barcode')} className="logger-starter-action">
                    Barcode
                  </button>
                  <button type="button" onClick={() => openEntryMode('label')} className="logger-starter-action">
                    Nutrition label
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {!items.length && entryMode === 'barcode' ? (
            <ChatBubble role="assistant" compact>
              <div className="chat-inline-tool-panel space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Barcode lookup</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Type the digits under the barcode and I’ll check the packaged-food match first.</p>
                </div>

                <label className="space-y-2 text-xs text-slate-500">
                  <span>Barcode digits</span>
                  <input
                    aria-label="Barcode digits"
                    inputMode="numeric"
                    value={barcodeInput}
                    onChange={(event) => setBarcodeInput(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="012345678905"
                    className="app-input px-4 py-3 text-sm"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        lookupBarcode();
                      }
                    }}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={lookupBarcode} disabled={!canLookupBarcode} className="app-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70">
                    {loading ? 'Looking up…' : 'Use barcode'}
                  </button>
                  <button type="button" onClick={closeEntryMode} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {!items.length && entryMode === 'label' ? (
            <ChatBubble role="assistant" compact>
              <div className="chat-inline-tool-panel space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Nutrition label</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Good for shakes, bars, and packaged meals. Calories are required, the rest are optional.</p>
                </div>

                <div className="chat-inline-tool-grid">
                  <label className="space-y-2 text-xs text-slate-500 md:col-span-2">
                    <span>Product name</span>
                    <input
                      aria-label="Product name"
                      value={nutritionLabelDraft.name}
                      onChange={(event) => updateNutritionLabelField('name', event.target.value)}
                      placeholder="Fairlife Core Power Elite"
                      className="app-input px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-slate-500">
                    <span>Serving amount</span>
                    <input
                      aria-label="Serving amount"
                      inputMode="decimal"
                      value={nutritionLabelDraft.servingQuantity}
                      onChange={(event) => updateNutritionLabelField('servingQuantity', event.target.value)}
                      className="app-input px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-slate-500">
                    <span>Serving unit</span>
                    <input
                      aria-label="Serving unit"
                      value={nutritionLabelDraft.servingUnit}
                      onChange={(event) => updateNutritionLabelField('servingUnit', event.target.value)}
                      placeholder="bottle"
                      className="app-input px-4 py-3 text-sm"
                    />
                  </label>
                  {[
                    ['calories', 'Calories'],
                    ['protein', 'Protein (g)'],
                    ['carbs', 'Carbs (g)'],
                    ['fat', 'Fat (g)'],
                    ['fiber', 'Fiber (g)'],
                    ['sugar', 'Sugar (g)'],
                    ['sodium', 'Sodium (mg)'],
                  ].map(([field, label]) => (
                    <label key={field} className="space-y-2 text-xs text-slate-500">
                      <span>{label}</span>
                      <input
                        aria-label={label}
                        inputMode="decimal"
                        value={nutritionLabelDraft[field as keyof NutritionLabelDraft]}
                        onChange={(event) => updateNutritionLabelField(field as keyof NutritionLabelDraft, event.target.value)}
                        className="app-input px-4 py-3 text-sm"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={useNutritionLabel} disabled={loading || !isOnline} className="app-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70">
                    {loading ? 'Building item…' : 'Use label'}
                  </button>
                  <button type="button" onClick={closeEntryMode} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {loading ? <TypingBubble title={typingCopy.title} subtitle={typingCopy.subtitle} /> : null}

          {error ? (
            <ChatBubble role="assistant" tone="warning" compact>
              <div className="space-y-3">
                <p className="text-sm leading-6 text-slate-700">{error}</p>
                {errorAction ? (
                  <button
                    type="button"
                    onClick={retryLastAction}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 active:scale-[0.99]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </button>
                ) : null}
              </div>
            </ChatBubble>
          ) : null}

          {items.length ? (
            <ChatBubble role="assistant">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{assistantEstimateMode === 'correction' ? 'Updated meal' : 'What I have so far'}</p>
                  <p className="text-sm leading-6 text-slate-700">{memoryCue ? `${memoryCue} ` : ''}Review the estimate, sources, and portions before saving.</p>
                </div>

                <div className="logger-review-panel space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="logger-review-stat">
                      <p className="logger-review-stat-label">Calories</p>
                      <p className="logger-review-stat-value">{Math.round(totals.calories)}</p>
                    </div>
                    <div className="logger-review-stat">
                      <p className="logger-review-stat-label">Protein</p>
                      <p className="logger-review-stat-value">{Math.round(totals.protein)}g</p>
                    </div>
                    <div className="logger-review-stat">
                      <p className="logger-review-stat-label">Carbs</p>
                      <p className="logger-review-stat-value">{Math.round(totals.carbs)}g</p>
                    </div>
                    <div className="logger-review-stat">
                      <p className="logger-review-stat-label">Fat</p>
                      <p className="logger-review-stat-value">{Math.round(totals.fat)}g</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{trustSummary.coverageSummary}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{trustSummary.estimatedSummary}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{Math.round(confidenceScore * 100)}% confidence</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{confidence.description}</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, index) => {
                      const expanded = expandedIndex === index;
                      const trustPresentation = getItemTrustPresentation(item);
                      const trusted = trustPresentation.trusted;
                      const sourceLabel = getItemSourceLabel(item);

                      return (
                        <article key={`${item.food_name}-${index}`} className="logger-food-item">
                          <button
                            type="button"
                            onClick={() => setExpandedIndex((current) => (current === index ? null : index))}
                            className="flex w-full items-start justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-950">{item.food_name}</p>
                                <TrustBadge trusted={trusted} compact label={trustPresentation.badgeLabel} tone={trustPresentation.badgeTone} />
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{sourceLabel}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{Math.round(item.calories)} cal</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">P {Math.round(item.protein)}g</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{item.quantity} {item.unit}</span>
                              </div>
                            </div>
                            <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                          </button>

                          {expanded ? (
                            <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <label className="space-y-2 text-xs text-slate-500 lg:col-span-2">
                                  <span>Food</span>
                                  <input value={item.food_name} onChange={(event) => updateItem(index, 'food_name', event.target.value)} className="app-input px-3 py-2 text-sm" />
                                </label>
                                <label className="space-y-2 text-xs text-slate-500">
                                  <span>Quantity</span>
                                  <input type="number" step="0.1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="app-input px-3 py-2 text-sm" />
                                </label>
                                <label className="space-y-2 text-xs text-slate-500">
                                  <span>Unit</span>
                                  <input value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} className="app-input px-3 py-2 text-sm" />
                                </label>
                                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                  <p className="font-medium text-slate-700">Source</p>
                                  <p className="mt-1">{sourceLabel}</p>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                  ['calories', 'Calories'],
                                  ['protein', 'Protein'],
                                  ['carbs', 'Carbs'],
                                  ['fat', 'Fat'],
                                ].map(([key, label]) => (
                                  <label key={key} className="space-y-2 text-xs text-slate-500">
                                    <span>{label}</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={item[key as keyof ParsedFoodItem] as number}
                                      onChange={(event) => updateItem(index, key as keyof ParsedFoodItem, event.target.value)}
                                      className="app-input px-3 py-2 text-sm"
                                    />
                                  </label>
                                ))}
                              </div>

                              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3 text-xs leading-5 text-slate-500">
                                <p className="font-medium text-slate-700">{trustPresentation.confidenceLabel}</p>
                                <p className="mt-1">{trustPresentation.helperText}</p>
                                {item.notes ? <p className="mt-2">{item.notes}</p> : null}
                              </div>

                              <div className="flex justify-end">
                                <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]">
                                  <X className="h-4 w-4" />
                                  Remove item
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveMeal}
                    disabled={!canSaveMeal}
                    className="app-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {hasSavedCurrentDraft ? 'Saved' : saving ? 'Saving…' : 'Save it'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(0)}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    <PencilLine className="h-4 w-4" />
                    Adjust items
                  </button>
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add item
                  </button>
                  <button
                    type="button"
                    onClick={saveFavorite}
                    disabled={!canSaveFavorite}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    {favoriteSaving
                      ? 'Saving…'
                      : sourceReusableMealId
                        ? favoriteState === 'dirty'
                          ? 'Update favorite'
                          : 'Favorited'
                        : 'Save favorite'}
                  </button>
                  {sourceReusableMealId ? (
                    <button
                      type="button"
                      onClick={removeFavorite}
                      disabled={favoriteSaving}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Star className="h-4 w-4" />
                      {favoriteSaving ? 'Removing…' : 'Remove favorite'}
                    </button>
                  ) : null}
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {saveMessage ? (
            <ChatBubble role="assistant" tone="success" compact>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Next</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => startAnotherMeal()} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    <Plus className="h-4 w-4" />
                    Log another
                  </button>
                  <Link href="/history" className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    View history
                  </Link>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          <div ref={feedEndRef} className="chat-feed-end" aria-hidden="true" />
        </div>
      </section>

      <div className="app-chat-composer-shell">
        <div className="app-chat-composer-inner app-screen">
          {utilityMenuOpen ? (
            <div className="chat-utility-menu">
              <button
                type="button"
                onClick={() => openEntryMode('barcode')}
                className={clsx('chat-utility-action', entryMode === 'barcode' && 'chat-utility-action-active')}
              >
                Barcode
              </button>
              <button
                type="button"
                onClick={() => openEntryMode('label')}
                className={clsx('chat-utility-action', entryMode === 'label' && 'chat-utility-action-active')}
              >
                Nutrition label
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerText(promptExamples[0]);
                  setUtilityMenuOpen(false);
                }}
                className="chat-utility-action"
              >
                Use an example
              </button>
            </div>
          ) : null}

          <div className="app-chat-composer-card">
            {!items.length && entryMode === 'chat' && !clarifyingQuestion && quickSuggestions.length ? (
              <div className="chat-suggestion-row" aria-label="Quick suggestions">
                {quickSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => {
                      setUtilityMenuOpen(false);
                      sendAssistantMessage(suggestion.prompt);
                    }}
                    className="chat-suggestion-chip"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="chat-composer-meta-row">
              <label className="chat-meal-type-field">
                <select
                  aria-label="Meal type"
                  value={mealType}
                  onChange={(event) => {
                    const nextMealType = event.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack';
                    setMealType(nextMealType);
                    setAssistantState((current) => ({
                      ...current,
                      mealType: nextMealType,
                    }));
                  }}
                  className="chat-meal-type-select"
                >
                  {mealTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="chat-composer-hint">{compactComposerHint}</p>
            </div>

            <div className="chat-composer-row">
              <button
                type="button"
                onClick={() => setUtilityMenuOpen((current) => !current)}
                className={clsx('chat-utility-toggle', utilityMenuOpen && 'chat-utility-toggle-active')}
                aria-label="Open helper actions"
              >
                <Plus className="h-4 w-4" />
              </button>

              <div className="chat-composer-input-shell">
                <textarea
                  ref={composerRef}
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  rows={1}
                  className="chat-composer-textarea"
                  placeholder={clarifyingQuestion ? 'Add the one detail that matters here' : items.length ? 'Add, remove, or correct anything' : 'Tell me what you ate'}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitComposer();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={submitComposer}
                  disabled={!canSend}
                  className="chat-send-button"
                  aria-label={clarifyingQuestion ? 'Send clarification' : 'Send meal'}
                >
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
