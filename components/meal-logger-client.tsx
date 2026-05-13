'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';

import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';

const mealTypeOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const;

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

function getConfidenceLabel(score: number) {
  if (score >= 0.85) {
    return {
      title: 'High confidence',
      description: 'Specific meal details or a recognized restaurant pattern made this estimate stronger.',
    };
  }

  if (score >= 0.65) {
    return {
      title: 'Moderate confidence',
      description: 'This estimate looks reasonable, but a few portions or ingredients may still be approximated.',
    };
  }

  return {
    title: 'Low confidence',
    description: 'This meal likely needs more detail before the estimate is truly trustworthy.',
  };
}

export function MealLoggerClient() {
  const router = useRouter();
  const [mealText, setMealText] = useState('I had a Chipotle bowl with white rice, double chicken, cheese, corn salsa, lettuce, and green salsa.');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [items, setItems] = useState<ParsedFoodItem[]>([]);
  const [confidenceScore, setConfidenceScore] = useState(0.82);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeResult, setActiveResult] = useState<ParsedMealResponse | null>(null);

  const totals = useMemo(() => sumTotals(items), [items]);
  const confidence = getConfidenceLabel(confidenceScore);

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
      setLoading(false);
      return;
    }

    setClarifyingQuestion(null);
    setItems(parsed.items);
    setClarificationAnswer('');
    setLoading(false);
  }

  async function saveMeal() {
    setSaving(true);
    setError(null);

    const response = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_type: mealType,
        confidence_score: confidenceScore,
        raw_text: mealText,
        items,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setSaving(false);
      setError(data.error ?? 'Could not save this meal.');
      return;
    }

    router.push('/?saved=1');
    router.refresh();
  }

  function updateItem(index: number, key: keyof ParsedFoodItem, value: string | number) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: ['food_name', 'unit', 'notes'].includes(key) ? value : Number(value),
            }
          : item
      )
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">AI Meal Logger</p>
            <h1 className="text-3xl font-semibold text-white">Log meals naturally</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Describe what you ate like a normal person. Calorie Compass will estimate the meal, surface a confidence score, and let you confirm before anything gets saved.
            </p>
          </div>
          <div className="hidden rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100 md:block">
            <p className="font-medium">Tip</p>
            <p className="mt-2 max-w-xs text-emerald-100/80">More specific meals usually skip the follow-up question and go straight to confirmation.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <textarea
            value={mealText}
            onChange={(event) => setMealText(event.target.value)}
            rows={6}
            className="min-h-40 rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm text-white outline-none focus:border-emerald-400"
          />
          <div className="space-y-4">
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Meal type</span>
              <select
                value={mealType}
                onChange={(event) => setMealType(event.target.value as typeof mealType)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400"
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Estimating...' : 'Estimate meal'}
            </button>
            <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs leading-5 text-slate-400">
              Nutrition estimates are approximate and are not medical or dietary advice.
            </p>
          </div>
        </div>

        {clarifyingQuestion ? (
          <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 text-amber-300" />
              <div className="space-y-3">
                <p className="text-sm font-semibold text-white">One useful follow-up</p>
                <p className="text-sm text-amber-100">{clarifyingQuestion}</p>
                <input
                  value={clarificationAnswer}
                  onChange={(event) => setClarificationAnswer(event.target.value)}
                  placeholder="Example: 6 oz grilled chicken and 1.5 cups rice"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
                />
                <button
                  type="button"
                  onClick={parseMeal}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Re-estimate with detail
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      </section>

      {items.length ? (
        <section className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Confirmation</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Review the estimate before saving</h2>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              <p>
                {confidence.title} <span className="ml-2 font-semibold text-white">{Math.round(confidenceScore * 100)}%</span>
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">{confidence.description}</p>
            </div>
          </div>

          <div className="grid gap-4">
            {items.map((item, index) => (
              <div key={`${item.food_name}-${index}`} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-2 text-xs text-slate-400 lg:col-span-2">
                    <span>Food</span>
                    <input
                      value={item.food_name}
                      onChange={(event) => updateItem(index, 'food_name', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    <span>Quantity</span>
                    <input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-slate-400">
                    <span>Unit</span>
                    <input
                      value={item.unit}
                      onChange={(event) => updateItem(index, 'unit', event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
                  {[
                    ['calories', 'Calories'],
                    ['protein', 'Protein'],
                    ['carbs', 'Carbs'],
                    ['fat', 'Fat'],
                    ['fiber', 'Fiber'],
                    ['sugar', 'Sugar'],
                    ['sodium', 'Sodium'],
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-2 text-xs text-slate-400">
                      <span>{label}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={item[key as keyof ParsedFoodItem] as number}
                        onChange={(event) => updateItem(index, key as keyof ParsedFoodItem, event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estimated totals</p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Calories</p><p className="text-2xl font-semibold text-white">{Math.round(totals.calories)}</p></div>
                <div><p className="text-xs text-slate-500">Protein</p><p className="text-2xl font-semibold text-white">{Math.round(totals.protein)}g</p></div>
                <div><p className="text-xs text-slate-500">Carbs</p><p className="text-2xl font-semibold text-white">{Math.round(totals.carbs)}g</p></div>
                <div><p className="text-xs text-slate-500">Fat</p><p className="text-2xl font-semibold text-white">{Math.round(totals.fat)}g</p></div>
              </div>
            </div>
            <div className="flex items-end justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setActiveResult(null);
                }}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={saveMeal}
                disabled={saving}
                className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving meal...' : 'Confirm and save'}
              </button>
            </div>
          </div>
        </section>
      ) : activeResult && !activeResult.needs_clarification ? null : (
        <section className="rounded-[32px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Try: “I had a protein shake with almond milk” or “I had chicken and rice” to see the clarification flow.
        </section>
      )}
    </div>
  );
}
