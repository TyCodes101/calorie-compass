'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, Sparkles } from 'lucide-react';

type OnboardingInitial = {
  name?: string;
  age?: number | null;
  heightCm?: number | null;
  weightLbs?: number | null;
  goal?: 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_MUSCLE';
  activityLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  dailyCalorieGoal?: number;
  proteinGoal?: number;
};

const steps = ['Welcome', 'Goal', 'Targets', 'Basics', 'Start'];

const goalOptions = [
  { value: 'LOSE_WEIGHT', label: 'Lose weight', description: 'Stay in a comfortable calorie deficit and keep protein high.' },
  { value: 'MAINTAIN', label: 'Maintain', description: 'Keep your intake steady and consistent day to day.' },
  { value: 'GAIN_MUSCLE', label: 'Build muscle', description: 'Focus on protein and a steady calorie surplus.' },
] as const;

export function OnboardingForm({ initial }: { initial?: OnboardingInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: initial?.name ?? 'Tyler',
    age: initial?.age ?? 20,
    heightCm: initial?.heightCm ?? 180,
    weightLbs: initial?.weightLbs ?? 182,
    goal: initial?.goal ?? 'LOSE_WEIGHT',
    activityLevel: initial?.activityLevel ?? 'MODERATE',
    dailyCalorieGoal: initial?.dailyCalorieGoal ?? 2300,
    proteinGoal: initial?.proteinGoal ?? 180,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  function goNext() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function finish() {
    setSaving(true);
    setError(null);

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setSaving(false);
      setError('Could not save onboarding. Please check your details and try again.');
      return;
    }

    router.push('/logger');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Step {step + 1} of {steps.length}</span>
          <span>{steps[step]}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step === 0 ? (
        <section className="space-y-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-950">Get started in under a minute</h2>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              We’ll keep this lightweight. Just set your goal, a couple of daily targets, and the basics needed to make your dashboard useful right away.
            </p>
          </div>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>What should we call you?</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="app-input px-4 py-3"
            />
          </label>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">What feels most important right now?</h2>
            <p className="mt-2 text-sm text-slate-600">Pick the goal that best matches how you want the app to guide your day.</p>
          </div>
          <div className="grid gap-3">
            {goalOptions.map((option) => {
              const active = form.goal === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, goal: option.value }))}
                  className={`rounded-[24px] border px-5 py-4 text-left transition ${active ? 'border-teal-300 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <p className="font-semibold text-slate-950">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Set your daily targets</h2>
            <p className="mt-2 text-sm text-slate-600">You can adjust these anytime later from Profile.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Daily calorie target</span>
              <input
                type="number"
                value={form.dailyCalorieGoal}
                onChange={(event) => setForm((current) => ({ ...current, dailyCalorieGoal: Number(event.target.value) }))}
                className="app-input px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Protein target</span>
              <input
                type="number"
                value={form.proteinGoal}
                onChange={(event) => setForm((current) => ({ ...current, proteinGoal: Number(event.target.value) }))}
                className="app-input px-4 py-3"
              />
            </label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Add the basics</h2>
            <p className="mt-2 text-sm text-slate-600">Just enough information to make your targets feel personal, without turning setup into homework.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>Age</span>
              <input type="number" value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: Number(event.target.value) }))} className="app-input px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Height (cm)</span>
              <input type="number" value={form.heightCm} onChange={(event) => setForm((current) => ({ ...current, heightCm: Number(event.target.value) }))} className="app-input px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Weight (lb)</span>
              <input type="number" value={form.weightLbs} onChange={(event) => setForm((current) => ({ ...current, weightLbs: Number(event.target.value) }))} className="app-input px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>Activity level, optional</span>
              <select value={form.activityLevel} onChange={(event) => setForm((current) => ({ ...current, activityLevel: event.target.value as typeof form.activityLevel }))} className="app-select px-4 py-3">
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
                <option value="VERY_HIGH">Very high</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-5 rounded-[28px] border border-teal-100 bg-gradient-to-br from-white to-teal-50/70 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">You’re ready to log your first meal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Next, try something natural like “Chipotle bowl with white rice and chicken” or “protein shake with almond milk.” You’ll be able to review everything before it saves.
            </p>
          </div>
          <div className="rounded-[24px] border border-white bg-white/90 p-4 text-sm text-slate-600 shadow-sm">
            <p><span className="font-medium text-slate-900">Goal:</span> {goalOptions.find((option) => option.value === form.goal)?.label}</p>
            <p className="mt-1"><span className="font-medium text-slate-900">Targets:</span> {form.dailyCalorieGoal} calories, {form.proteinGoal}g protein</p>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || saving}
          className="app-button-secondary inline-flex items-center gap-2 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {step < steps.length - 1 ? (
          <button type="button" onClick={goNext} className="app-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={saving} className="app-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70">
            {saving ? 'Saving...' : 'Start logging'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
