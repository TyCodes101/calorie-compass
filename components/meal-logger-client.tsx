'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LoaderCircle, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';

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

export function MealLoggerClient({ initialDraft = null }: { initialDraft?: LoggerDraft | null }) {
  const router = useRouter();
  const [mealText, setMealText] = useState(initialDraft?.rawText ?? 'Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(initialDraft?.mealType ?? 'lunch');
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [items, setItems] = useState<ParsedFoodItem[]>(initialDraft?.items ?? []);
  const [confidenceScore, setConfidenceScore] = useState(initialDraft?.confidenceScore ?? 0.82);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [favoriteState, setFavoriteState] = useState<'idle' | 'saved'>(initialDraft?.sourceReusableMealId ? 'saved' : 'idle');
  const [activeResult, setActiveResult] = useState<ParsedMealResponse | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceReusableMealId, setSourceReusableMealId] = useState<string | null>(initialDraft?.sourceReusableMealId ?? null);

  const totals = useMemo(() => sumTotals(items), [items]);
  const trustSummary = useMemo(() => summarizeParsedItems(items), [items]);
  const confidence = getConfidenceCopy(confidenceScore);

  async function parseMeal() {
    setLoading(true);
    setError(null);

    const fullText = clarificationAnswer
      ? `${mealText}\nAdditional detail: ${clarificationAnswer}`
      : mealText;

    const response = await fetch('/api/ai/parse-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText, mealType }),
    });

    const data = await response.json();

    if (!response.ok) {
      setLoading(false);
      setError(data.error ?? 'Could not estimate that meal right now.');
      return;
    }

    const parsed = data as ParsedMealResponse;
    setActiveResult(parsed);
    setConfidenceScore(parsed.confidence_score);

    if (parsed.needs_clarification) {
      setClarifyingQuestion(parsed.clarifying_question);
      setItems([]);
      setExpandedIndex(null);
      setLoading(false);
      return;
    }

    setClarifyingQuestion(null);
    setItems(parsed.items);
    setExpandedIndex(null);
    setClarificationAnswer('');
    setLoading(false);
  }

  async function saveMeal() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
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
        setSaving(false);
        setError(data?.error ?? 'We couldn’t save your meal right now. Please try again.');
        return;
      }

      router.push('/?saved=1');
      router.refresh();
    } catch {
      setSaving(false);
      setError('We couldn’t save your meal right now. Please try again.');
    }
  }

  async function saveFavorite() {
    setFavoriteSaving(true);
    setError(null);

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
        setFavoriteSaving(false);
        setError(data?.error ?? 'We couldn’t save your favorite right now. Please try again.');
        return;
      }

      setSourceReusableMealId(data?.favoriteMeal?.id ?? sourceReusableMealId);
      setFavoriteState('saved');
      setFavoriteSaving(false);
      router.refresh();
    } catch {
      setFavoriteSaving(false);
      setError('We couldn’t save your favorite right now. Please try again.');
    }
  }

  function updateItem(index: number, key: keyof ParsedFoodItem, value: string | number | null) {
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
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setExpandedIndex((current) => (current === index ? null : current));
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 pb-40 sm:px-6">
      <section className="app-card rounded-[32px] p-6">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div className="space-y-5">
            <div>
              <p className="app-section-label">Log Meal</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Describe your meal naturally</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                We’ll parse it, show what looks verified versus estimated, and let you confirm everything before anything saves.
              </p>
            </div>

            <textarea
              value={mealText}
              onChange={(event) => setMealText(event.target.value)}
              rows={6}
              className="app-textarea min-h-44 px-4 py-4 text-sm"
              placeholder="Try: 3 scrambled eggs and 2 slices of toast"
            />

            <div className="flex flex-wrap gap-2">
              {promptExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setMealText(example)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <label className="block space-y-2 text-sm text-slate-600">
              <span>Meal type</span>
              <select
                value={mealType}
                onChange={(event) => setMealType(event.target.value as typeof mealType)}
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
              className="app-button-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Analyzing meal...' : 'Review meal'}
            </button>

            <div className="rounded-[24px] border border-white bg-white/90 p-4 text-sm text-slate-600 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-600" />
                <div>
                  <p className="font-medium text-slate-900">Trust comes before saving</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Verified items will show trusted source labels. Estimated items stay clearly marked so you can adjust them fast.
                  </p>
                  {sourceReusableMealId ? (
                    <p className="mt-2 text-xs font-medium text-teal-700">Loaded from a saved favorite. Saving logs a fresh meal without changing your past entries.</p>
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
                  className="app-button-secondary px-4 py-2 text-sm font-medium transition hover:border-amber-200 hover:text-amber-700"
                >
                  Re-run meal review
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      {items.length ? (
        <section className="space-y-4">
          <div className="sticky top-4 z-10 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="app-section-label">Review</p>
                <h2 className="text-2xl font-semibold text-slate-950">{confidence.title}</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">{confidence.description}</p>
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
                    className="flex w-full items-start justify-between gap-4 text-left"
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
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">AI Notes</p>
                          <p className="mt-2 leading-6">{item.notes}</p>
                        </div>
                      ) : null}

                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100">
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

          <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-5xl px-4 sm:px-6">
            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Ready to save this meal</p>
                  <p className="text-sm text-slate-500">{trustSummary.coverageSummary}. {trustSummary.estimatedSummary}.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setItems([]);
                      setActiveResult(null);
                      setExpandedIndex(null);
                      setSourceReusableMealId(null);
                      setFavoriteState('idle');
                    }}
                    className="app-button-secondary px-4 py-3 text-sm font-medium"
                  >
                    Start over
                  </button>
                  <button
                    type="button"
                    onClick={saveFavorite}
                    disabled={favoriteSaving}
                    className="app-button-secondary px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {favoriteSaving ? 'Saving favorite...' : favoriteState === 'saved' ? 'Favorite saved' : 'Save as favorite'}
                  </button>
                  <button
                    type="button"
                    onClick={saveMeal}
                    disabled={saving}
                    className="app-button-primary px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? 'Saving meal...' : 'Confirm and save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : activeResult && !activeResult.needs_clarification ? null : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500">
          Try a meal like “Protein shake with almond milk” or “3 scrambled eggs and 2 slices of toast” to see the confirmation flow.
        </section>
      )}
    </div>
  );
}
