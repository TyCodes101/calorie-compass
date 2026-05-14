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

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { TrustBadge } from '@/components/trust-badge';
import type { RecentMealQuickLog } from '@/lib/history';
import { buildLoggerGoalReply, buildLoggerIntentReply, buildLoggerQuestionReply, detectLoggerCommand, detectLoggerIntent } from '@/lib/logger-intent';
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

type ActionKind = 'parse' | 'save' | 'favorite' | 'removeFavorite';

type Notice = {
  tone: 'success' | 'info';
  text: string;
};

type QuickLogProps = {
  initialDraft?: LoggerDraft | null;
  favoriteMeals?: FavoriteMealSummary[];
  recentMeals?: RecentMealQuickLog[];
  nutritionPreferences?: string | null;
  userName?: string | null;
  proteinGoal?: number | null;
  dailyCalorieGoal?: number | null;
  todayProtein?: number | null;
  todayCalories?: number | null;
  remainingProtein?: number | null;
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

const numberWordMap: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCountToken(value: string) {
  const normalized = value.trim().toLowerCase();

  if (numberWordMap[normalized] !== undefined) {
    return numberWordMap[normalized];
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function detectSimpleQuantityCorrection(message: string) {
  const normalized = message.trim().toLowerCase();
  const match = normalized.match(/(?:make that|actually it was|it was|that was|actually|update that to)\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/);

  if (!match) {
    return null;
  }

  return parseCountToken(match[1] ?? '');
}

function scaleParsedItems(items: ParsedFoodItem[], nextCount: number) {
  if (!items.length || nextCount <= 0) {
    return items;
  }

  const baseline = items.length === 1 && items[0]?.quantity > 0 ? items[0].quantity : 1;
  const factor = nextCount / baseline;

  return items.map((item) => ({
    ...item,
    quantity: Number((item.quantity * factor).toFixed(2)),
    calories: Number((item.calories * factor).toFixed(1)),
    protein: Number((item.protein * factor).toFixed(1)),
    carbs: Number((item.carbs * factor).toFixed(1)),
    fat: Number((item.fat * factor).toFixed(1)),
    fiber: Number((item.fiber * factor).toFixed(1)),
    sugar: Number((item.sugar * factor).toFixed(1)),
    sodium: Number((item.sodium * factor).toFixed(1)),
  }));
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

function buildHistoryReply(message: string, recentMeals: RecentMealQuickLog[]) {
  const normalized = message.trim().toLowerCase();

  if (!recentMeals.length) {
    return "I don't have any recent meals to pull from yet. Once you log a few, I can use them here.";
  }

  if (/today/.test(normalized)) {
    const todayMeals = recentMeals.filter((meal) => !isYesterday(meal.createdAt) && new Date(meal.createdAt).toDateString() === new Date().toDateString());

    if (!todayMeals.length) {
      return "You haven't logged anything today yet.";
    }

    const mealList = todayMeals
      .slice(0, 3)
      .map((meal) => `${meal.title} (${meal.totalCalories} cal)`)
      .join(', ');

    return `Today you've logged ${mealList}.`;
  }

  if (/yesterday/.test(normalized)) {
    const yesterdayMeals = recentMeals.filter((meal) => isYesterday(meal.createdAt));

    if (!yesterdayMeals.length) {
      return "You didn't log anything yesterday yet, at least not in the recent history I have here.";
    }

    const mealList = yesterdayMeals
      .slice(0, 2)
      .map((meal) => `${meal.title} (${meal.totalCalories} cal)`)
      .join(' and ');

    return `Yesterday you logged ${mealList}.`;
  }

  const lastMeal = recentMeals[0];
  if (/last meal|last thing|recent meal/.test(normalized)) {
    return `Your last meal was ${lastMeal.title}, about ${lastMeal.totalCalories} calories.`;
  }

  const mealList = recentMeals
    .slice(0, 3)
    .map((meal) => meal.title)
    .join(', ');
  return `Recently you've logged ${mealList}.`;
}

function buildRecommendationReply(
  message: string,
  options: {
    favoriteMeals: FavoriteMealSummary[];
    recentMeals: RecentMealQuickLog[];
    proteinGoal?: number | null;
  },
) {
  const normalized = message.trim().toLowerCase();
  const repeatedMeals = [...options.favoriteMeals.map((meal) => meal.title), ...options.recentMeals.map((meal) => meal.title)];
  const yesterdayDinner = options.recentMeals.find((meal) => isYesterday(meal.createdAt) && meal.mealType === 'dinner');
  const highProteinPick = repeatedMeals.find((title) => /fairlife|core power|chicken|chipotle|protein|greek yogurt|eggs/i.test(title));
  const easyPick = repeatedMeals.find((title) => /shake|bowl|sandwich|wrap|yogurt/i.test(title));
  const lunchDinnerPick = repeatedMeals.find((title) => /chipotle|bowl|sandwich|burger|salad|taco|dinner|lunch/i.test(title));

  if (/(yesterday|again|repeat)/.test(normalized) && yesterdayDinner) {
    return `If you want something easy, you could repeat yesterday’s dinner, ${yesterdayDinner.title}.`;
  }

  if (/protein/.test(normalized) && highProteinPick) {
    return `If you want something easy and higher protein, ${highProteinPick} looks like a good fit.`;
  }

  if (/(lunch|dinner)/.test(normalized) && lunchDinnerPick) {
    return `You could keep it simple and repeat ${lunchDinnerPick}. That's already in your rhythm.`;
  }

  if (easyPick) {
    return `You could go with ${easyPick} if you want something familiar and quick.`;
  }

  if (options.proteinGoal) {
    return `I'd lean toward something simple with solid protein so you can move toward your ${Math.round(options.proteinGoal)}g goal without overthinking it.`;
  }

  return 'I’d keep it simple and go with something easy to repeat, then adjust from there.';
}

function createChatMessage(role: ChatMessage['role'], text: string, options?: Pick<ChatMessage, 'tone' | 'compact'>): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    tone: options?.tone ?? 'default',
    compact: options?.compact ?? role === 'assistant',
  };
}

function buildInitialAssistantMessage(options: {
  firstName?: string | null;
  editingMealId?: string | null;
  sourceReusableMealId?: string | null;
  hasYesterdayMeal?: boolean;
}) {
  if (options.editingMealId) {
    return 'I pulled up that saved meal. Make any changes you want, then save it again.';
  }

  if (options.sourceReusableMealId) {
    return 'I pulled up that favorite. You can log it as-is or tweak it first.';
  }

  return `Hey${options.firstName ? ` ${options.firstName}` : ''}, what'd you eat today${options.hasYesterdayMeal ? '? I can also repeat yesterday’s dinner if that helps.' : '?'}`;
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

function isYesterday(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return date.getUTCFullYear() === yesterday.getUTCFullYear() && date.getUTCMonth() === yesterday.getUTCMonth() && date.getUTCDate() === yesterday.getUTCDate();
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
          'chat-bubble max-w-[92%] rounded-[28px] px-4 py-3 shadow-sm sm:max-w-[85%]',
          compact && 'px-3.5 py-2.5',
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

function TypingBubble() {
  return (
    <ChatBubble role="assistant" compact>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <LoaderCircle className="h-4 w-4 animate-spin text-teal-600" />
        <div>
          <p className="font-medium text-slate-900">Give me a second</p>
          <p className="mt-0.5 text-xs text-slate-500">I’m checking the closest match.</p>
        </div>
      </div>
    </ChatBubble>
  );
}

function ConversationQuickStarts({
  quickFavorites,
  quickRecentMeals,
  quickYesterdayMeals,
}: {
  quickFavorites: FavoriteMealSummary[];
  quickRecentMeals: RecentMealQuickLog[];
  quickYesterdayMeals: RecentMealQuickLog[];
}) {
  if (!quickFavorites.length && !quickRecentMeals.length && !quickYesterdayMeals.length) {
    return null;
  }

  return (
    <ChatBubble role="assistant" compact>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">Want a faster start? Pick something familiar.</p>

        {quickYesterdayMeals.length ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Yesterday</p>
            <div className="flex flex-wrap gap-2">
              {quickYesterdayMeals.slice(0, 2).map((meal) => (
                <Link key={`yesterday-${meal.id}`} href={`/logger?mealId=${meal.id}`} className="chat-quick-chip">
                  {meal.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {quickFavorites.length ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Favorites</p>
            <div className="flex flex-wrap gap-2">
              {quickFavorites.map((favorite) => (
                <Link key={favorite.id} href={`/logger?favorite=${favorite.id}`} className="chat-quick-chip chat-quick-chip-accent">
                  {favorite.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {quickRecentMeals.length ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recent</p>
            <div className="flex flex-wrap gap-2">
              {quickRecentMeals.map((meal) => (
                <Link key={meal.id} href={`/logger?mealId=${meal.id}`} className="chat-quick-chip">
                  {meal.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ChatBubble>
  );
}

export function MealLoggerClient({
  initialDraft = null,
  favoriteMeals = [],
  recentMeals = [],
  nutritionPreferences = null,
  userName = null,
  proteinGoal = null,
  dailyCalorieGoal = null,
  todayProtein = null,
  todayCalories = null,
  remainingProtein = null,
  remainingCalories = null,
  todayMealCount = null,
}: QuickLogProps) {
  const router = useRouter();
  const firstName = userName?.trim()?.split(/\s+/)[0] ?? null;
  const initialQuickYesterdayMeals = recentMeals.filter((meal) => isYesterday(meal.createdAt));
  const [entryMode, setEntryMode] = useState<EntryMode>('chat');
  const [composerText, setComposerText] = useState(initialDraft?.items?.length ? '' : initialDraft?.rawText ?? '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [nutritionLabelDraft, setNutritionLabelDraft] = useState<NutritionLabelDraft>(() => defaultNutritionLabelDraft());
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => initialDraft?.mealType ?? getDefaultMealType());
  const [activePrompt, setActivePrompt] = useState(initialDraft?.rawText ?? '');
  const [displayUserMessage, setDisplayUserMessage] = useState(initialDraft?.rawText ?? '');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() =>
    initialDraft?.rawText
      ? [
          createChatMessage('assistant', buildInitialAssistantMessage({ firstName, editingMealId: initialDraft?.editingMealId ?? null, sourceReusableMealId: initialDraft?.sourceReusableMealId ?? null, hasYesterdayMeal: initialQuickYesterdayMeals.length > 0 })),
          createChatMessage('user', initialDraft.rawText, { compact: false }),
        ]
      : [createChatMessage('assistant', buildInitialAssistantMessage({ firstName, editingMealId: initialDraft?.editingMealId ?? null, sourceReusableMealId: initialDraft?.sourceReusableMealId ?? null, hasYesterdayMeal: initialQuickYesterdayMeals.length > 0 }))],
  );
  const [assistantChatReply, setAssistantChatReply] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [latestUserReply, setLatestUserReply] = useState('');
  const [items, setItems] = useState<ParsedFoodItem[]>(initialDraft?.items ?? []);
  const [confidenceScore, setConfidenceScore] = useState(initialDraft?.confidenceScore ?? 0.82);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
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
  const [assistantEstimateMode, setAssistantEstimateMode] = useState<'initial' | 'correction'>('initial');
  const isOnline = useOnlineStatus();

  const totals = useMemo(() => sumTotals(items), [items]);
  const trustSummary = useMemo(() => summarizeParsedItems(items), [items]);
  const confidence = getConfidenceCopy(confidenceScore);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const quickFavorites = favoriteMeals.slice(0, 4);
  const quickRecentMeals = recentMeals
    .filter((meal) => meal.id !== editingMealId)
    .filter((meal, index, collection) => collection.findIndex((entry) => entry.id === meal.id) === index)
    .slice(0, 4);
  const quickYesterdayMeals = quickRecentMeals.filter((meal) => isYesterday(meal.createdAt));
  const canSaveMeal = items.length > 0 && !saving && isOnline && !hasSavedCurrentDraft;
  const canSaveFavorite = items.length > 0 && !favoriteSaving && !(sourceReusableMealId && favoriteState === 'saved') && isOnline;
  const canSend = composerText.trim().length > 0 && !loading && isOnline;
  const canLookupBarcode = barcodeInput.replace(/\D/g, '').length >= 8 && !loading && isOnline;
  const conversationPrompt = displayUserMessage || activePrompt;
  const memoryCue = useMemo(() => buildMemoryCue(conversationPrompt, favoriteMeals, recentMeals), [conversationPrompt, favoriteMeals, recentMeals]);

  useEffect(() => {
    if (!composerRef.current) {
      return;
    }

    composerRef.current.style.height = '0px';
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 160)}px`;
  }, [composerText]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, activePrompt, displayUserMessage, assistantChatReply, clarifyingQuestion, latestUserReply, items, loading, error, notice, saveMessage, expandedIndex, entryMode]);

  function appendChatMessage(role: ChatMessage['role'], text: string, options?: Pick<ChatMessage, 'tone' | 'compact'>) {
    if (!text.trim()) {
      return;
    }

    setChatHistory((current) => [...current, createChatMessage(role, text, options)]);
  }

  function clearFeedback() {
    setError(null);
    setErrorAction(null);
    setNotice(null);
    setSaveMessage(null);
  }

  function markDraftChanged() {
    clearFeedback();
    setHasSavedCurrentDraft(false);

    if (sourceReusableMealId) {
      setFavoriteState((current) => (current === 'saved' ? 'dirty' : current));
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
    setAssistantChatReply(null);
    setItems([]);
    setClarifyingQuestion(null);
    setLatestUserReply('');
    setExpandedIndex(null);
    setSourceReusableMealId(null);
    setFavoriteState('idle');
    setEditingMealId(null);
    setUtilityMenuOpen(false);
    setHasSavedCurrentDraft(false);
    setLastParseOptions(null);
    setAssistantEstimateMode('initial');
    if (!options?.preserveThread) {
      setChatHistory([createChatMessage('assistant', buildInitialAssistantMessage({ firstName, hasYesterdayMeal: quickYesterdayMeals.length > 0 }))]);
    }
  }

  function startAnotherMeal(message = 'Ready for the next one. What’d you eat?') {
    resetDraft({ preserveThread: true });
    appendChatMessage('assistant', message, { compact: true });
  }

  function addManualItem() {
    const nextIndex = items.length;
    markDraftChanged();
    setItems((current) => [...current, buildManualItem()]);
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
    setAssistantEstimateMode('initial');
    setSaveMessage(null);

    if (triggerText) {
      appendChatMessage('user', triggerText, { compact: true });
    }

    appendChatMessage('assistant', `Got it, I loaded ${meal.title} again. I’ll keep it here so you can save it or tweak it first.`);
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
    setNotice(null);
    setSaveMessage(null);
    setLastParseOptions(options ?? null);
    setAssistantChatReply(null);
    setUtilityMenuOpen(false);

    const fullText = isClarification ? `${prompt}\nAdditional detail: ${nextInput}` : isCorrection ? nextInput : prompt;

    if (!isDirectPackageInput && nextInput) {
      appendChatMessage('user', nextInput, { compact: mode !== 'new' });
    }

    if (!isClarification && !isCorrection) {
      setActivePrompt(prompt);
      setDisplayUserMessage(prompt);
    } else {
      setLatestUserReply(nextInput);
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
        setNotice(null);
        setAssistantEstimateMode('initial');
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

      setClarifyingQuestion(null);
      setItems(parsed.items);
      setExpandedIndex(null);
      setEntryMode('chat');
      setBarcodeInput('');
      setNutritionLabelDraft(defaultNutritionLabelDraft());
      setComposerText('');
      setAssistantEstimateMode(isCorrection ? 'correction' : 'initial');
      setNotice(null);

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
    if (conversationPrompt || items.length || clarifyingQuestion || latestUserReply || saveMessage) {
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
    setNotice(null);
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

      setSaving(false);
      setHasSavedCurrentDraft(true);
      setSaveMessage(editingMealId ? 'Updated it.' : 'Saved it. Want to log anything else?');
      setNotice({ tone: 'success', text: editingMealId ? 'Updated it.' : 'Saved it.' });
      appendChatMessage('assistant', editingMealId ? 'Updated it.' : 'Saved it. Want to log anything else?', { tone: 'success' });
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
    setNotice(null);

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

      setSourceReusableMealId(data?.favoriteMeal?.id ?? sourceReusableMealId);
      setFavoriteState('saved');
      setFavoriteSaving(false);
      setNotice({
        tone: 'success',
        text: sourceReusableMealId ? 'Updated your favorite.' : 'Saved that as a favorite.',
      });
      appendChatMessage('assistant', sourceReusableMealId ? 'Updated your favorite.' : 'Saved that as a favorite.', { tone: 'success' });
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
    setNotice(null);

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

      setSourceReusableMealId(null);
      setFavoriteState('idle');
      setFavoriteSaving(false);
      setNotice({ tone: 'success', text: 'Removed the favorite. The meal is still here if you want it.' });
      appendChatMessage('assistant', 'Removed the favorite. The meal is still here if you want it.', { tone: 'success' });
      router.refresh();
    } catch {
      setFavoriteSaving(false);
      setError('We couldn’t remove that favorite right now. Please try again.');
      setErrorAction('removeFavorite');
    }
  }

  function retryLastAction() {
    if (errorAction === 'parse') {
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
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const isText = ['food_name', 'unit', 'notes', 'source_name', 'source_type', 'catalog_food_id'].includes(key);
        return {
          ...item,
          [key]: isText ? value : Number(value),
        };
      }),
    );
  }

  function removeItem(index: number) {
    markDraftChanged();
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setExpandedIndex((current) => (current === index ? null : current));
  }

  function applySimpleQuantityCorrection(message: string) {
    const nextCount = detectSimpleQuantityCorrection(message);

    if (!nextCount || !items.length) {
      return false;
    }

    const nextItems = scaleParsedItems(items, nextCount);

    markDraftChanged();
    setLatestUserReply(message);
    setAssistantChatReply(null);
    setClarifyingQuestion(null);
    appendChatMessage('user', message, { compact: true });
    setItems(nextItems);
    setAssistantEstimateMode('correction');
    setComposerText('');
    appendChatMessage(
      'assistant',
      buildAssistantEstimateCopy({
        prompt: conversationPrompt,
        items: nextItems,
        totalCalories: sumTotals(nextItems).calories,
        totalProtein: sumTotals(nextItems).protein,
        estimatedCount: summarizeParsedItems(nextItems).estimatedCount,
        mode: 'correction',
      }),
    );
    return true;
  }

  function applyMealTypeCorrection(message: string) {
    const match = message.trim().toLowerCase().match(/\b(breakfast|lunch|dinner|snack)\b/);

    if (!match || !items.length) {
      return false;
    }

    const nextMealType = match[1] as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    setMealType(nextMealType);
    setLatestUserReply(message);
    appendChatMessage('user', message, { compact: true });
    setAssistantChatReply(`Got it, I changed this to ${nextMealType}.`);
    appendChatMessage('assistant', `Got it, I changed this to ${nextMealType}.`);
    setComposerText('');
    return true;
  }

  function applyMacroCorrection(message: string) {
    if (!items.length) {
      return false;
    }

    const normalized = message.trim().toLowerCase();
    const fieldPatterns: Array<{ regex: RegExp; field: keyof ParsedFoodItem; label: string; unit: string }> = [
      { regex: /(calories?|cal)\D*(\d+(?:\.\d+)?)/i, field: 'calories', label: 'calories', unit: '' },
      { regex: /(protein)\D*(\d+(?:\.\d+)?)/i, field: 'protein', label: 'protein', unit: 'g' },
      { regex: /(carbs?)\D*(\d+(?:\.\d+)?)/i, field: 'carbs', label: 'carbs', unit: 'g' },
      { regex: /(fat)\D*(\d+(?:\.\d+)?)/i, field: 'fat', label: 'fat', unit: 'g' },
    ];

    const matchConfig = fieldPatterns.find((entry) => entry.regex.test(normalized));
    if (!matchConfig) {
      return false;
    }

    const match = normalized.match(matchConfig.regex);
    const nextValue = Number(match?.[2] ?? '');
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      return false;
    }

    markDraftChanged();
    setLatestUserReply(message);
    setAssistantChatReply(null);
    setClarifyingQuestion(null);
    appendChatMessage('user', message, { compact: true });

    setItems((current) => {
      if (!current.length) {
        return current;
      }

      if (current.length === 1) {
        return [
          {
            ...current[0],
            [matchConfig.field]: nextValue,
          },
        ];
      }

      const restTotal = current.slice(1).reduce((sum, item) => sum + Number(item[matchConfig.field] as number), 0);
      const firstValue = Math.max(0, nextValue - restTotal);

      return current.map((item, index) =>
        index === 0
          ? {
              ...item,
              [matchConfig.field]: firstValue,
            }
          : item,
      );
    });

    setAssistantEstimateMode('correction');
    setComposerText('');
    appendChatMessage('assistant', 'Got it, I updated that in the current meal.');
    return true;
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

    if (command !== 'none') {
      clearFeedback();
      setAssistantChatReply(null);
      setLatestUserReply(message);
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

      if (command === 'save') {
        saveMeal();
        return;
      }

      if (command === 'start_over') {
        appendChatMessage('assistant', 'Okay, I cleared that. What do you want to log instead?');
        startAnotherMeal();
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

    if (clarifyingQuestion) {
      parseMeal({ mode: 'clarification' });
      return;
    }

    const intent = detectLoggerIntent(message, { hasActiveMeal });

    if (intent === 'correction' && hasActiveMeal) {
      if (applySimpleQuantityCorrection(message)) {
        return;
      }

      if (applyMealTypeCorrection(message)) {
        return;
      }

      if (applyMacroCorrection(message)) {
        return;
      }

      parseMeal({
        text: message,
        mode: 'correction',
        correctionText: message,
      });
      return;
    }

    if (intent === 'nutrition_question') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      appendChatMessage('user', message, { compact: hasActiveMeal });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (hasActiveMeal) {
        setLatestUserReply(message);
      } else {
        setDisplayUserMessage(message);
      }

      const reply = buildLoggerQuestionReply(message, {
        proteinGoal,
        dailyCalorieGoal,
        todayProtein,
        todayCalories,
        remainingProtein,
        remainingCalories,
        currentMealProtein: totals.protein,
        currentMealCalories: totals.calories,
      });
      setAssistantChatReply(reply);
      appendChatMessage('assistant', reply);
      return;
    }

    if (intent === 'goal_question') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      appendChatMessage('user', message, { compact: hasActiveMeal });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (hasActiveMeal) {
        setLatestUserReply(message);
      } else {
        setDisplayUserMessage(message);
      }

      const reply = buildLoggerGoalReply(message, {
        proteinGoal,
        dailyCalorieGoal,
        todayProtein,
        todayCalories,
        remainingProtein,
        remainingCalories,
        todayMealCount,
      });
      setAssistantChatReply(reply);
      appendChatMessage('assistant', reply);
      return;
    }

    if (intent === 'meal_history_question') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      appendChatMessage('user', message, { compact: hasActiveMeal });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (hasActiveMeal) {
        setLatestUserReply(message);
      } else {
        setDisplayUserMessage(message);
      }

      const reply = buildHistoryReply(message, recentMeals);
      setAssistantChatReply(reply);
      appendChatMessage('assistant', reply);
      return;
    }

    if (intent === 'recommendation_request') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      appendChatMessage('user', message, { compact: hasActiveMeal });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (hasActiveMeal) {
        setLatestUserReply(message);
      } else {
        setDisplayUserMessage(message);
      }

      const reply = buildRecommendationReply(message, {
        favoriteMeals,
        recentMeals,
        proteinGoal,
      });
      setAssistantChatReply(reply);
      appendChatMessage('assistant', reply);
      return;
    }

    if (intent !== 'food_log') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      appendChatMessage('user', message, { compact: hasActiveMeal });
      setComposerText('');
      setUtilityMenuOpen(false);

      if (!hasActiveMeal) {
        setDisplayUserMessage(message);
      } else {
        setLatestUserReply(message);
      }

      const reply = buildLoggerIntentReply(intent, {
        userName,
        hasActiveMeal,
      });
      setAssistantChatReply(reply);
      appendChatMessage('assistant', reply);
      return;
    }

    setLatestUserReply('');
    parseMeal({ mode: 'new' });
  }

  return (
    <div className="logger-assistant-screen app-page-chat flex min-w-0 flex-col py-3">
      <div className="logger-assistant-topbar app-screen">
        <Link href="/" aria-label="Back to dashboard" className="logger-topbar-button">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="logger-topbar-title">Log meal</p>
        </div>
        <div className="logger-topbar-button opacity-0" aria-hidden="true" />
      </div>

      <section className="logger-assistant-thread-shell app-screen">
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

          {!items.length && entryMode === 'chat' && chatHistory.length <= 2 ? (
            <ConversationQuickStarts
              quickFavorites={quickFavorites}
              quickRecentMeals={quickRecentMeals}
              quickYesterdayMeals={quickYesterdayMeals}
            />
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

          {loading ? <TypingBubble /> : null}

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
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{assistantEstimateMode === 'correction' ? 'Updated review' : 'Review'}</p>
                  <p className="text-sm leading-6 text-slate-700">{memoryCue ? `${memoryCue} ` : ''}Adjust anything you want before you save it.</p>
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

                              {item.notes ? (
                                <p className="text-xs leading-5 text-slate-500">{item.notes}</p>
                              ) : null}

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

          <div ref={feedEndRef} />
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
            <div className="chat-composer-meta-row">
              <label className="chat-meal-type-field">
                <span className="chat-meal-type-label">Meal type</span>
                <select
                  aria-label="Meal type"
                  value={mealType}
                  onChange={(event) => setMealType(event.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack')}
                  className="chat-meal-type-select"
                >
                  {mealTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="chat-composer-hint">
                {clarifyingQuestion
                  ? 'A short answer is enough here.'
                  : entryMode === 'barcode'
                    ? 'Barcode is open.'
                    : entryMode === 'label'
                      ? 'Label entry is open.'
                      : nutritionPreferences?.trim()
                        ? `Talk normally, I’ll keep ${nutritionPreferences.trim()} in mind.`
                        : 'Talk normally, I’ll handle the match.'}
              </p>
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
                  placeholder={clarifyingQuestion ? 'Type the one detail that would make the estimate more accurate' : 'Tell the assistant what you ate'}
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
