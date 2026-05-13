'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { TrustBadge } from '@/components/trust-badge';
import { type LoggerDraft } from '@/lib/reusable-meals';
import { getConfidenceCopy, getItemSourceLabel, summarizeParsedItems } from '@/lib/trust';

const mealTypeOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const;

const promptExamples = [
  'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa',
  'Protein shake with almond milk',
  '3 scrambled eggs and 2 slices of toast',
];

type ActionKind = 'parse' | 'save' | 'favorite' | 'removeFavorite';

type Notice = {
  tone: 'success' | 'info';
  text: string;
};

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
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
  );
}

function shouldTrackFieldFocus(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <div className={`rounded-[24px] border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
      {notice.text}
    </div>
  );
}

export function MealLoggerClient({ initialDraft = null }: { initialDraft?: LoggerDraft | null }) {
  const router = useRouter();
  const [mealText, setMealText] = useState(initialDraft?.rawText ?? '');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(initialDraft?.mealType ?? 'lunch');
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [items, setItems] = useState<ParsedFoodItem[]>(initialDraft?.items ?? []);
  const [confidenceScore, setConfidenceScore] = useState(initialDraft?.confidenceScore ?? 0.82);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<Notice | null>(
    initialDraft?.editingMealId
      ? { tone: 'info', text: 'Editing a saved meal. You can adjust anything here before saving the updated version.' }
      : initialDraft?.sourceReusableMealId
        ? { tone: 'info', text: 'Loaded from a saved favorite. You can log it as-is or tweak it first.' }
        : null
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteState, setFavoriteState] = useState<'idle' | 'saved' | 'dirty'>(initialDraft?.sourceReusableMealId ? 'saved' : 'idle');
  const [activeResult, setActiveResult] = useState<ParsedMealResponse | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceReusableMealId, setSourceReusableMealId] = useState<string | null>(initialDraft?.sourceReusableMealId ?? null);
  const [editingMealId] = useState<string | null>(initialDraft?.editingMealId ?? null);
  const [isFieldFocused, setIsFieldFocused] = useState(false);

  const totals = useMemo(() => sumTotals(items), [items]);
  const trustSummary = useMemo(() => summarizeParsedItems(items), [items]);
  const confidence = getConfidenceCopy(confidenceScore);
  const saveButtonLabel = editingMealId ? 'Save changes' : 'Confirm and save';
  const canSaveMeal = items.length > 0 && !saving;
  const canSaveFavorite = items.length > 0 && !favoriteSaving && !(sourceReusableMealId && favoriteState === 'saved');

  function clearFeedback() {
    setError(null);
    setErrorAction(null);
    setNotice(null);
  }

  function markDraftChanged() {
    clearFeedback();

    if (sourceReusableMealId) {
      setFavoriteState((current) => (current === 'saved' ? 'dirty' : current));
    }
  }

  async function parseMeal() {
    if (loading || mealText.trim().length < 3) {
      return;
    }

    setLoading(true);
    setError(null);
    setErrorAction(null);
    setNotice(null);
    setClarifyingQuestion(null);

    const fullText = clarificationAnswer
      ? `${mealText}\nAdditional detail: ${clarificationAnswer}`
      : mealText;

    try {
      const response = await fetch('/api/ai/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, mealType }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'We could not estimate that meal right now. Please try again.');
        setErrorAction('parse');
        return;
      }

      const parsed = data as ParsedMealResponse;
      setActiveResult(parsed);
      setConfidenceScore(parsed.confidence_score);

      if (parsed.needs_clarification) {
        setClarifyingQuestion(parsed.clarifying_question);
        setItems([]);
        setExpandedIndex(null);
        setNotice({ tone: 'info', text: 'We can estimate most meals directly. This one needs one quick detail first.' });
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
      setClarificationAnswer('');
      setNotice({ tone: 'info', text: 'Estimated foods are clearly labeled below. You can adjust anything before saving.' });
    } catch {
      setError('We could not estimate that meal right now. Please try again.');
      setErrorAction('parse');
    } finally {
      setLoading(false);
    }
  }

  async function saveMeal() {
    if (!canSaveMeal) {
      return;
    }

    setSaving(true);
    setError(null);
    setErrorAction(null);
    setNotice(null);

    try {
      const endpoint = editingMealId ? `/api/meals/${editingMealId}` : '/api/meals';
      const method = editingMealId ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          confidence_score: confidenceScore,
          raw_text: mealText,
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

      router.push(editingMealId ? '/?updated=1' : '/?saved=1');
      router.refresh();
    } catch {
      setSaving(false);
      setError('We couldn’t save your meal right now. Please try again.');
      setErrorAction('save');
    }
  }

  async function saveFavorite() {
    if (!canSaveFavorite) {
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
          raw_text: mealText,
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
        text: sourceReusableMealId ? 'Favorite updated.' : 'Saved to favorites for faster repeat logging.',
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
      setNotice({ tone: 'success', text: 'Favorite removed. You can still save this meal normally.' });
      router.refresh();
    } catch {
      setFavoriteSaving(false);
      setError('We couldn’t remove that favorite right now. Please try again.');
      setErrorAction('removeFavorite');
    }
  }

  function retryLastAction() {
    if (errorAction === 'parse') {
      parseMeal();
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
      })
    );
  }

  function removeItem(index: number) {
    markDraftChanged();
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setExpandedIndex((current) => (current === index ? null : current));
  }

  function resetDraft() {
    clearFeedback();
    setMealText('');
    setItems([]);
    setActiveResult(null);
    setClarifyingQuestion(null);
    setClarificationAnswer('');
    setExpandedIndex(null);
    setSourceReusableMealId(null);
    setFavoriteState('idle');
  }

  return (
    <div
      className="app-page-with-action-bar app-screen-wide flex min-w-0 flex-col gap-6 py-6"
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
      {notice ? <NoticeBanner notice={notice} /> : null}

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid min-w-0 gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
          <div className="space-y-5">
            <div>
              <p className="app-section-label">Log Meal</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">{editingMealId ? 'Update your saved meal' : 'Describe your meal naturally'}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                We’ll estimate first when a reasonable default exists, clearly label anything estimated, and let you adjust everything before saving.
              </p>
            </div>

            <textarea
              value={mealText}
              onChange={(event) => {
                markDraftChanged();
                setMealText(event.target.value);
              }}
              rows={5}
              className="app-textarea min-h-40 px-4 py-4 text-sm"
              placeholder="Try: 3 scrambled eggs and 2 slices of toast"
            />

            <div className="flex flex-wrap gap-2">
              {promptExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    markDraftChanged();
                    setMealText(example);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:text-teal-700 active:scale-[0.99]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <label className="block space-y-2 text-sm text-slate-600">
              <span>Meal type</span>
              <select
                value={mealType}
                onChange={(event) => {
                  markDraftChanged();
                  setMealType(event.target.value as typeof mealType);
                }}
                className="app-select px-4 py-3"
              >
                {mealTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={parseMeal}
              disabled={loading || mealText.trim().length < 3}
              className="app-button-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Analyzing meal...' : items.length ? 'Re-estimate meal' : 'Review meal'}
            </button>

            <div className="rounded-[24px] border border-white bg-white/90 p-4 text-sm text-slate-600 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-600" />
                <div>
                  <p className="font-medium text-slate-900">Trust comes before saving</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Verified items show trusted source labels. Estimated items stay clearly marked, and you can manually adjust calories or macros before anything saves.
                  </p>
                  {editingMealId ? (
                    <p className="mt-2 text-xs font-medium text-teal-700">You are editing an existing meal, not creating a duplicate.</p>
                  ) : sourceReusableMealId ? (
                    <p className="mt-2 text-xs font-medium text-teal-700">Loaded from a saved favorite. Saving logs a fresh meal without changing your past entries unless you update the favorite too.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {clarifyingQuestion ? (
          <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">One quick follow-up</p>
                <p className="text-sm text-slate-700">{clarifyingQuestion}</p>
                <input
                  value={clarificationAnswer}
                  onChange={(event) => setClarificationAnswer(event.target.value)}
                  placeholder="Example: 6 oz grilled chicken and 1.5 cups rice"
                  className="app-input px-4 py-3 text-sm"
                />
                <button
                  type="button"
                  onClick={parseMeal}
                  className="app-button-secondary px-4 py-2 text-sm font-medium transition hover:border-amber-200 hover:text-amber-700 active:scale-[0.99]"
                >
                  Re-run meal review
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p>{error}</p>
            {errorAction ? (
              <button
                type="button"
                onClick={retryLastAction}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 font-medium text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-start gap-3">
              <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Reviewing your meal</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Checking trusted matches first, then filling in anything that still needs an estimate.</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {items.length ? (
        <section className="space-y-4">
          <div className="sticky top-4 z-10 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="app-section-label">Review</p>
                <h2 className="text-2xl font-semibold text-slate-950">{confidence.title}</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">{confidence.description}</p>
                <p className="text-sm leading-6 text-slate-600">Estimated foods are labeled below. You can adjust any item, macro, or calorie value before saving.</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{trustSummary.coverageSummary}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{trustSummary.estimatedSummary}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{Math.round(confidenceScore * 100)}% confidence</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Calories</p>
                  <p className="text-2xl font-semibold text-slate-950">{Math.round(totals.calories)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Protein</p>
                  <p className="text-2xl font-semibold text-slate-950">{Math.round(totals.protein)}g</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Carbs</p>
                  <p className="text-2xl font-semibold text-slate-950">{Math.round(totals.carbs)}g</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fat</p>
                  <p className="text-2xl font-semibold text-slate-950">{Math.round(totals.fat)}g</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const expanded = expandedIndex === index;
              const trusted = Boolean(item.is_trusted && item.source_type !== 'AI_ESTIMATE');
              const sourceLabel = getItemSourceLabel(item);

              return (
                <article key={`${item.food_name}-${index}`} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedIndex((current) => (current === index ? null : index))}
                    className="flex w-full items-start justify-between gap-4 text-left active:scale-[0.995]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-slate-950">{item.food_name}</p>
                        <TrustBadge trusted={trusted} compact />
                      </div>
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
                        You can fine-tune this item before saving. Estimated entries are safe to adjust if the portion or brand looks off.
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

          {!isFieldFocused ? (
            <div className="app-floating-action-bar">
              <div className="app-floating-action-bar-inner rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{editingMealId ? 'Ready to update this meal' : 'Ready to save this meal'}</p>
                    <p className="text-sm text-slate-500">{trustSummary.coverageSummary}. {trustSummary.estimatedSummary}.</p>
                  </div>
                  <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
                    <button type="button" onClick={resetDraft} className="app-button-secondary w-full px-4 py-3 text-sm font-medium sm:w-auto">
                      Start over
                    </button>
                    <button
                      type="button"
                      onClick={saveFavorite}
                      disabled={!canSaveFavorite}
                      className="app-button-secondary w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
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
                        className="inline-flex w-full items-center justify-center rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                      >
                        {favoriteSaving ? 'Removing...' : 'Remove favorite'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={saveMeal}
                      disabled={!canSaveMeal}
                      className="app-button-primary w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {saving ? (editingMealId ? 'Saving changes...' : 'Saving meal...') : saveButtonLabel}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : activeResult && !activeResult.needs_clarification ? null : (
        <section className="app-empty-state rounded-[28px] p-6 text-sm text-slate-500">
          <p className="font-semibold text-slate-900">Start with a quick natural description</p>
          <p className="mt-2 leading-6">
            Try something like “2 rice cakes”, “1 Greek yogurt”, “protein shake”, or “3 scrambled eggs and 2 slices of toast” to go straight from input to review.
          </p>
        </section>
      )}
    </div>
  );
}
