'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

export function OnboardingForm({ initial }: { initial?: OnboardingInitial }) {
  const router = useRouter();
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setSaving(false);
      setError('Could not save onboarding. Please check your fields and try again.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['Name', 'name', 'text'],
          ['Age', 'age', 'number'],
          ['Height (cm)', 'heightCm', 'number'],
          ['Weight (lb)', 'weightLbs', 'number'],
        ].map(([label, key, type]) => (
          <label key={key} className="space-y-2 text-sm text-slate-300">
            <span>{label}</span>
            <input
              type={type}
              value={form[key as keyof typeof form] as string | number}
              onChange={(event) => setForm((current) => ({ ...current, [key]: type === 'text' ? event.target.value : Number(event.target.value) }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0 transition focus:border-emerald-400"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Goal</span>
          <select
            value={form.goal}
            onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value as typeof form.goal }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="LOSE_WEIGHT">Lose weight</option>
            <option value="MAINTAIN">Maintain</option>
            <option value="GAIN_MUSCLE">Gain muscle</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Activity level</span>
          <select
            value={form.activityLevel}
            onChange={(event) => setForm((current) => ({ ...current, activityLevel: event.target.value as typeof form.activityLevel }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
            <option value="VERY_HIGH">Very high</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-300">
          <span>Daily calorie goal</span>
          <input
            type="number"
            value={form.dailyCalorieGoal}
            onChange={(event) => setForm((current) => ({ ...current, dailyCalorieGoal: Number(event.target.value) }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Protein goal</span>
          <input
            type="number"
            value={form.proteinGoal}
            onChange={(event) => setForm((current) => ({ ...current, proteinGoal: Number(event.target.value) }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400"
          />
        </label>
      </div>

      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? 'Saving profile...' : 'Save and continue'}
      </button>
    </form>
  );
}
