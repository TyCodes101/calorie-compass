'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  PencilLine,
  Plus,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { TrustBadge } from '@/components/trust-badge';
import type { RecentMealQuickLog } from '@/lib/history';
import { buildLoggerIntentReply, detectLoggerIntent } from '@/lib/logger-intent';
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

function shouldTrackFieldFocus(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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

function buildAssistantEstimateCopy(prompt: string, totalCalories: number, fullyTrusted: boolean) {
  const normalizedPrompt = shorten(cleanPromptForReply(prompt) || 'that meal');
  const lead = fullyTrusted ? 'Matched' : 'Estimated';

  return `${lead} as ${normalizedPrompt}. About ${Math.round(totalCalories)} calories. Adjust anything before saving.`;
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

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <div className={`rounded-[24px] border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
      {notice.text}
    </div>
  );
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
          <p className="font-medium text-slate-900">Checking trusted matches first</p>
          <p className="mt-0.5 text-xs text-slate-500">Pulling the best estimate before you save anything.</p>
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
    <ChatBubble role="assistant">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">Want a faster start?</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Use something familiar and let the assistant tighten it up instead of starting from scratch.</p>
        </div>

        {quickYesterdayMeals.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Repeat yesterday</p>
            <div className="grid gap-2">
              {quickYesterdayMeals.slice(0, 2).map((meal) => (
                <Link key={`yesterday-${meal.id}`} href={`/logger?mealId=${meal.id}`} className="chat-choice-card">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{meal.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{meal.totalCalories} cal, {meal.mealType}</p>
                  </div>
                  <span className="chat-choice-pill">Re-log</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {quickFavorites.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Favorites</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickFavorites.map((favorite) => (
                <Link key={favorite.id} href={`/logger?favorite=${favorite.id}`} className="chat-choice-card">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{favorite.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{favorite.totalCalories} cal, {favorite.itemCount} items</p>
                  </div>
                  <span className="chat-choice-pill chat-choice-pill-accent">Favorite</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {quickRecentMeals.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent meals</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickRecentMeals.map((meal) => (
                <Link key={meal.id} href={`/logger?mealId=${meal.id}`} className="chat-choice-card">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{meal.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{meal.totalCalories} cal, {meal.mealType}</p>
                  </div>
                  <span className="chat-choice-pill">Use again</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ChatBubble>
  );
}

export function MealLoggerClient({ initialDraft = null, favoriteMeals = [], recentMeals = [], nutritionPreferences = null, userName = null }: QuickLogProps) {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<EntryMode>('chat');
  const [composerText, setComposerText] = useState(initialDraft?.items?.length ? '' : initialDraft?.rawText ?? '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [nutritionLabelDraft, setNutritionLabelDraft] = useState<NutritionLabelDraft>(() => defaultNutritionLabelDraft());
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => initialDraft?.mealType ?? getDefaultMealType());
  const [activePrompt, setActivePrompt] = useState(initialDraft?.rawText ?? '');
  const [displayUserMessage, setDisplayUserMessage] = useState(initialDraft?.rawText ?? '');
  const [assistantChatReply, setAssistantChatReply] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [lastClarificationReply, setLastClarificationReply] = useState('');
  const [items, setItems] = useState<ParsedFoodItem[]>(initialDraft?.items ?? []);
  const [confidenceScore, setConfidenceScore] = useState(initialDraft?.confidenceScore ?? 0.82);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<Notice | null>(
    initialDraft?.editingMealId
      ? { tone: 'info', text: 'I loaded your saved meal. You can adjust it inline and save the updated version when it looks right.' }
      : initialDraft?.sourceReusableMealId
        ? { tone: 'info', text: 'I pulled in that favorite. Log it as-is or tweak anything first.' }
        : null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteState, setFavoriteState] = useState<'idle' | 'saved' | 'dirty'>(initialDraft?.sourceReusableMealId ? 'saved' : 'idle');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceReusableMealId, setSourceReusableMealId] = useState<string | null>(initialDraft?.sourceReusableMealId ?? null);
  const [editingMealId, setEditingMealId] = useState<string | null>(initialDraft?.editingMealId ?? null);
  const [isFieldFocused, setIsFieldFocused] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasSavedCurrentDraft, setHasSavedCurrentDraft] = useState(false);
  const [lastParseOptions, setLastParseOptions] = useState<ParseRequestOptions | null>(null);
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
  const conversationPrompt = displayUserMessage || activePrompt || initialDraft?.rawText || '';
  const assistantEstimateCopy = items.length
    ? buildAssistantEstimateCopy(conversationPrompt, totals.calories, trustSummary.estimatedCount === 0)
    : null;

  useEffect(() => {
    if (!composerRef.current) {
      return;
    }

    composerRef.current.style.height = '0px';
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 160)}px`;
  }, [composerText]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activePrompt, displayUserMessage, assistantChatReply, clarifyingQuestion, lastClarificationReply, items, loading, error, notice, saveMessage, expandedIndex, entryMode]);

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

  function resetDraft() {
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
    setLastClarificationReply('');
    setExpandedIndex(null);
    setSourceReusableMealId(null);
    setFavoriteState('idle');
    setEditingMealId(null);
    setHasSavedCurrentDraft(false);
    setLastParseOptions(null);
  }

  function startAnotherMeal() {
    resetDraft();
    setNotice({ tone: 'info', text: 'Ready for the next one. Send a natural message and I’ll estimate it first.' });
  }

  function addManualItem() {
    const nextIndex = items.length;
    markDraftChanged();
    setItems((current) => [...current, buildManualItem()]);
    setExpandedIndex(nextIndex);
    setNotice({ tone: 'info', text: 'Custom item added. Fill in the nutrition that looks right, then save.' });
  }

  async function parseMeal(options?: ParseRequestOptions) {
    const isDirectPackageInput = Boolean(options?.barcode || options?.nutritionLabel);
    const isClarification = Boolean(clarifyingQuestion) && !isDirectPackageInput;
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

    const fullText = isClarification ? `${prompt}\nAdditional detail: ${nextInput}` : prompt;

    if (!isClarification) {
      setActivePrompt(prompt);
      setDisplayUserMessage(prompt);
    } else {
      setLastClarificationReply(nextInput);
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
        setClarifyingQuestion(parsed.clarifying_question);
        setItems([]);
        setExpandedIndex(null);
        setComposerText('');
        setNotice(null);
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
      setLastClarificationReply('');
      setNotice({ tone: 'info', text: 'Your estimate is ready. Edit anything inline before saving if it looks off.' });
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
    if (conversationPrompt || items.length || clarifyingQuestion || lastClarificationReply || saveMessage) {
      resetDraft();
    }

    clearFeedback();
    setEntryMode(mode);
  }

  function closeEntryMode() {
    setEntryMode('chat');
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
      setSaveMessage(editingMealId ? 'Saved your changes. The updated meal is now reflected across the app.' : 'Saved to today. You can log another meal whenever you are ready.');
      setNotice({ tone: 'success', text: editingMealId ? 'Meal updated.' : 'Meal saved.' });
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
        text: sourceReusableMealId ? 'Favorite updated for future quick logs.' : 'Saved to favorites for faster repeat logging.',
      });
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
      setNotice({ tone: 'success', text: 'Favorite removed. The meal itself is still ready to save normally.' });
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

  function submitComposer() {
    const message = composerText.trim();

    if (!message || loading) {
      return;
    }

    if (clarifyingQuestion) {
      parseMeal();
      return;
    }

    const intent = detectLoggerIntent(message);

    if (intent !== 'food_log') {
      clearFeedback();
      setLastParseOptions(null);
      setEntryMode('chat');
      setComposerText('');

      if (!items.length) {
        setDisplayUserMessage(message);
      }

      setAssistantChatReply(
        buildLoggerIntentReply(intent, {
          userName,
          hasActiveMeal: items.length > 0,
        }),
      );
      return;
    }

    parseMeal();
  }

  return (
    <div
      className="app-page-chat app-screen-wide flex min-w-0 flex-col gap-6 py-6"
      onFocusCapture={(event) => {
        if (shouldTrackFieldFocus(event.target)) {
          setIsFieldFocused(true);
        }
      }}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          if (!shouldTrackFieldFocus(document.activeElement)) {
            setIsFieldFocused(false);
          }
        });
      }}
    >
      {!isOnline ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium text-slate-900">You are offline right now.</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">You can still review recent meals and edit values, but estimating and saving need a connection.</p>
            </div>
          </div>
        </div>
      ) : null}
      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className="app-card min-w-0 overflow-hidden rounded-[32px] p-4 md:p-6">
        <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="app-section-label">AI meal assistant</p>
            <h1 className="mt-2 text-[1.85rem] font-semibold leading-tight text-slate-950 sm:text-3xl">Talk through your meals naturally</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Calorie Compass now behaves more like a nutrition assistant than a form. Send a natural message, get an estimate first, and edit only if something looks off.
            </p>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/75 px-4 py-3 text-sm text-slate-600 shadow-sm md:max-w-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-teal-600" />
              <div>
                <p className="font-medium text-slate-900">Trust stays visible</p>
                <p className="mt-1 leading-6">Trusted sources come first. Estimates stay labeled, and you can correct anything before it saves.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="chat-thread mt-5 space-y-4">
          <ChatBubble role="assistant">
            <div className="space-y-2 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">{editingMealId ? 'I loaded your saved meal.' : sourceReusableMealId ? 'I loaded that favorite.' : 'Tell me what you ate.'}</p>
              <p>
                {editingMealId
                  ? 'I’ll keep the structure clean, and you can update the saved version once the nutrition looks right.'
                  : sourceReusableMealId
                    ? 'I can log it as-is or you can tweak the nutrition inline before you save.'
                    : 'I’ll estimate first, keep the source confidence clear, and only ask one follow-up if the meal is truly too vague.'}
              </p>
              {nutritionPreferences?.trim() ? (
                <p className="text-xs leading-5 text-slate-500">I’ll keep your saved preferences in mind: {nutritionPreferences.trim()}</p>
              ) : null}
            </div>
          </ChatBubble>

          {!conversationPrompt && !items.length ? (
            <ConversationQuickStarts
              quickFavorites={quickFavorites}
              quickRecentMeals={quickRecentMeals}
              quickYesterdayMeals={quickYesterdayMeals}
            />
          ) : null}

          {!conversationPrompt && !items.length ? (
            <ChatBubble role="assistant" compact>
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-900">Try one of these to get moving fast:</p>
                <div className="flex flex-wrap gap-2">
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setComposerText(example)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:text-teal-700 active:scale-[0.99]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {!conversationPrompt && !items.length ? (
            <ChatBubble role="assistant">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Logging something packaged?</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Use a barcode or the nutrition label when you want a product-first estimate instead of a generic food guess.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEntryMode('barcode')}
                    className={clsx('chat-tool-button', entryMode === 'barcode' && 'chat-tool-button-active')}
                  >
                    Enter barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => openEntryMode('label')}
                    className={clsx('chat-tool-button', entryMode === 'label' && 'chat-tool-button-active')}
                  >
                    Type nutrition label
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {!conversationPrompt && !items.length && entryMode === 'barcode' ? (
            <ChatBubble role="assistant">
              <div className="chat-inline-tool-panel space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Barcode lookup</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Type the digits under the barcode. I’ll try the packaged-food match before falling back to a broader estimate.</p>
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
                    {loading ? 'Looking up…' : 'Look up barcode'}
                  </button>
                  <button type="button" onClick={closeEntryMode} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {!conversationPrompt && !items.length && entryMode === 'label' ? (
            <ChatBubble role="assistant">
              <div className="chat-inline-tool-panel space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Nutrition label entry</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Great for protein bars, shakes, frozen meals, and anything with a clear label. Calories are required, the rest are optional.</p>
                </div>

                <div className="chat-inline-tool-grid">
                  <label className="space-y-2 text-xs text-slate-500 md:col-span-2">
                    <span>Product name, optional</span>
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
                    {loading ? 'Building item…' : 'Use nutrition label'}
                  </button>
                  <button type="button" onClick={closeEntryMode} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          {conversationPrompt ? (
            <ChatBubble role="user">
              <p className="text-sm font-medium leading-6">{conversationPrompt}</p>
            </ChatBubble>
          ) : null}

          {assistantChatReply ? (
            <ChatBubble role="assistant" compact>
              <p className="text-sm leading-6 text-slate-700">{assistantChatReply}</p>
            </ChatBubble>
          ) : null}

          {clarifyingQuestion ? (
            <ChatBubble role="assistant" compact>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <TriangleAlert className="h-3.5 w-3.5 text-teal-600" />
                  One quick follow-up
                </div>
                <p className="text-sm leading-6 text-slate-700">{clarifyingQuestion}</p>
              </div>
            </ChatBubble>
          ) : null}

          {lastClarificationReply ? (
            <ChatBubble role="user" compact>
              <p className="text-sm font-medium leading-6">{lastClarificationReply}</p>
            </ChatBubble>
          ) : null}

          {loading ? <TypingBubble /> : null}

          {error ? (
            <ChatBubble role="assistant" tone="warning">
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
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                    <Sparkles className="h-4 w-4" />
                    Assistant estimate ready
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold leading-7 text-slate-950">{assistantEstimateCopy}</p>
                    <p className="text-sm leading-6 text-slate-600">{confidence.description}</p>
                    <p className="text-sm leading-6 text-slate-500">Nutrition facts can vary by product and serving size.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Calories</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.calories)}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Protein</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.protein)}g</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Carbs</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.carbs)}g</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Fat</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(totals.fat)}g</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{trustSummary.coverageSummary}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{trustSummary.estimatedSummary}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{Math.round(confidenceScore * 100)}% confidence</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveMeal}
                    disabled={!canSaveMeal}
                    className="app-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {hasSavedCurrentDraft ? 'Saved' : saving ? 'Saving meal...' : 'Looks right, save meal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(0)}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700 active:scale-[0.99]"
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit items
                  </button>
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700 active:scale-[0.99]"
                  >
                    <Plus className="h-4 w-4" />
                    Add custom item
                  </button>
                  <button
                    type="button"
                    onClick={saveFavorite}
                    disabled={!canSaveFavorite}
                    className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    {favoriteSaving
                      ? 'Saving favorite...'
                      : sourceReusableMealId
                        ? favoriteState === 'dirty'
                          ? 'Update favorite'
                          : 'Favorite saved'
                        : 'Save as favorite'}
                  </button>
                  {sourceReusableMealId ? (
                    <button
                      type="button"
                      onClick={removeFavorite}
                      disabled={favoriteSaving}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Star className="h-4 w-4" />
                      {favoriteSaving ? 'Removing...' : 'Remove favorite'}
                    </button>
                  ) : null}
                  <button type="button" onClick={resetDraft} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    <RotateCcw className="h-4 w-4" />
                    Start over
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => {
                    const expanded = expandedIndex === index;
                    const trustPresentation = getItemTrustPresentation(item);
                    const trusted = trustPresentation.trusted;
                    const sourceLabel = getItemSourceLabel(item);

                    return (
                      <article key={`${item.food_name}-${index}`} className="rounded-[24px] border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_14px_28px_rgba(148,163,184,0.08)]">
                        <button
                          type="button"
                          onClick={() => setExpandedIndex((current) => (current === index ? null : index))}
                          className="flex w-full items-start justify-between gap-4 text-left active:scale-[0.995]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-base font-semibold text-slate-950">{item.food_name}</p>
                              <TrustBadge trusted={trusted} compact label={trustPresentation.badgeLabel} tone={trustPresentation.badgeTone} />
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-700">{trustPresentation.confidenceLabel}</p>
                            <p className="mt-1 text-sm text-slate-500">{sourceLabel}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{Math.round(item.calories)} cal</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">P {Math.round(item.protein)}g</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">C {Math.round(item.carbs)}g</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">F {Math.round(item.fat)}g</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <span className="text-sm font-semibold text-slate-700">{item.quantity} {item.unit}</span>
                            <ChevronDown className={`h-5 w-5 transition ${expanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {expanded ? (
                          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4">
                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                              <p>{trustPresentation.helperText}</p>
                              <p className="mt-1">You can fine-tune this item before saving. Estimated entries are safe to adjust if the portion or brand looks off.</p>
                            </div>

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
                              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                <p className="font-medium text-slate-700">Source</p>
                                <p className="mt-1">{sourceLabel}</p>
                                <p className="mt-2 text-[11px] text-slate-500">{trustPresentation.confidenceLabel}</p>
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
                              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Notes</p>
                                <p className="mt-2 leading-6">{item.notes}</p>
                              </div>
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
            </ChatBubble>
          ) : null}

          {saveMessage ? (
            <ChatBubble role="assistant" tone="success">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-950">{saveMessage}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={startAnotherMeal} className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    <Plus className="h-4 w-4" />
                    Log another meal
                  </button>
                  <Link href="/" className="app-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
                    View dashboard
                  </Link>
                </div>
              </div>
            </ChatBubble>
          ) : null}

          <div ref={feedEndRef} />
        </div>
      </section>

      <div className="app-chat-composer-shell">
        <div className="app-chat-composer-inner">
          <div className="app-chat-composer-card">
            <div className="flex items-center justify-between gap-3 pb-2.5">
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
              <div className="chat-helper-actions">
                <button
                  type="button"
                  onClick={() => openEntryMode('barcode')}
                  className={clsx('chat-helper-action', entryMode === 'barcode' && 'chat-helper-action-active')}
                >
                  Barcode
                </button>
                <button
                  type="button"
                  onClick={() => openEntryMode('label')}
                  className={clsx('chat-helper-action', entryMode === 'label' && 'chat-helper-action-active')}
                >
                  Label
                </button>
                <button
                  type="button"
                  onClick={() => setComposerText(promptExamples[0])}
                  className="chat-helper-action"
                >
                  Example
                </button>
              </div>
            </div>

            <div className="chat-composer-row">
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <p className="min-w-0 flex-1">
                {clarifyingQuestion
                  ? 'One focused answer is enough here.'
                  : entryMode === 'barcode'
                    ? 'Barcode entry is open above if you want a packaged-food lookup.'
                    : entryMode === 'label'
                      ? 'Nutrition label entry is open above for a product-first match.'
                  : isFieldFocused
                    ? 'Press enter to send. Use shift + enter for a new line.'
                    : 'Estimate first, edit only if needed.'}
              </p>
              <span className="text-[11px] font-medium text-slate-400">Chat-style logging, review before save</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
