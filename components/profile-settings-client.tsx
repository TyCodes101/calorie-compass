'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { ArrowLeft, BellRing, CheckCircle2, ChevronRight, LoaderCircle, MoonStar, Sparkles } from 'lucide-react';

import type { ProfileSettingsSnapshot } from '@/lib/profile-settings';

type PreferencesState = {
  energyUnit: 'calories' | 'kilojoules';
  weightUnit: 'lb' | 'kg';
  heightUnit: 'cm' | 'ft-in';
  defaultScreen: 'dashboard' | 'logger' | 'history' | 'insights';
};

type NotificationsState = {
  mealReminder: boolean;
  eveningReview: boolean;
  weeklySummary: boolean;
  reminderTime: string;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
};

const defaultPreferences: PreferencesState = {
  energyUnit: 'calories',
  weightUnit: 'lb',
  heightUnit: 'cm',
  defaultScreen: 'dashboard',
};

const defaultNotifications: NotificationsState = {
  mealReminder: true,
  eveningReview: true,
  weeklySummary: true,
  reminderTime: '18:00',
  quietHours: true,
  quietStart: '22:00',
  quietEnd: '08:00',
};

function readStoredPreferences() {
  if (typeof window === 'undefined') {
    return defaultPreferences;
  }

  try {
    const stored = window.localStorage.getItem('calorie-compass.preferences');
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function readStoredNotifications() {
  if (typeof window === 'undefined') {
    return defaultNotifications;
  }

  try {
    const stored = window.localStorage.getItem('calorie-compass.notifications');
    return stored ? { ...defaultNotifications, ...JSON.parse(stored) } : defaultNotifications;
  } catch {
    return defaultNotifications;
  }
}

const goalOptions = [
  {
    value: 'LOSE_WEIGHT',
    label: 'Lose weight',
    description: 'Aim for a steady deficit and keep protein support high.',
  },
  {
    value: 'MAINTAIN',
    label: 'Maintain',
    description: 'Keep intake steadier and focus on consistency.',
  },
  {
    value: 'GAIN_MUSCLE',
    label: 'Build muscle',
    description: 'Bias toward recovery, protein, and a modest surplus.',
  },
] as const;

const activityOptions = [
  {
    value: 'LOW',
    label: 'Low',
    description: 'Mostly sedentary days with light movement.',
  },
  {
    value: 'MODERATE',
    label: 'Moderate',
    description: 'Regular walking or a few active sessions each week.',
  },
  {
    value: 'HIGH',
    label: 'High',
    description: 'Frequent training or highly active days.',
  },
  {
    value: 'VERY_HIGH',
    label: 'Very high',
    description: 'Hard training or physically demanding days most of the week.',
  },
] as const;

function SaveState({ saving, savedLabel, error }: { saving: boolean; savedLabel: string; error: string | null }) {
  if (saving) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        Saving
      </div>
    );
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {savedLabel}
    </div>
  );
}

function SectionLayout({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description: string;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="app-page app-screen-narrow flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to profile
            </Link>
            <p className="app-section-label mt-4">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {badge ?? null}
        </div>
      </section>
      {children}
    </div>
  );
}

async function saveProfilePatch(patch: Partial<ProfileSettingsSnapshot>) {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? 'We couldn’t save your settings right now. Please try again.');
  }

  return data;
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-teal-500' : 'bg-slate-200'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function GoalsSettingsForm({ initial }: { initial: ProfileSettingsSnapshot }) {
  const [goal, setGoal] = useState(initial.goal);
  const [activityLevel, setActivityLevel] = useState(initial.activityLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      await saveProfilePatch({ goal, activityLevel });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We couldn’t save your settings right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionLayout
      title="Goals"
      description="Keep the app’s guidance aligned with what matters most right now, without reopening the full onboarding flow."
      badge={<SaveState saving={saving} savedLabel={saved ? 'Saved' : 'Unsaved'} error={error} />}
    >
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <p className="app-section-label">Primary goal</p>
        <div className="mt-5 grid gap-3">
          {goalOptions.map((option) => {
            const active = goal === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setGoal(option.value);
                  setSaved(false);
                }}
                className={`rounded-[24px] border px-5 py-4 text-left transition active:scale-[0.99] ${active ? 'border-teal-300 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <p className="font-semibold text-slate-950">{option.label}</p>
                <p className="mt-1 text-sm text-slate-600">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <p className="app-section-label">Daily activity pace</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {activityOptions.map((option) => {
            const active = activityLevel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setActivityLevel(option.value);
                  setSaved(false);
                }}
                className={`rounded-[24px] border px-5 py-4 text-left transition active:scale-[0.99] ${active ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <p className="font-semibold text-slate-950">{option.label}</p>
                <p className="mt-1 text-sm text-slate-600">{option.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={saving || saved} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Save goals'}
          </button>
        </div>
      </section>
    </SectionLayout>
  );
}

export function NutritionTargetsForm({ initial }: { initial: ProfileSettingsSnapshot }) {
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(initial.dailyCalorieGoal);
  const [proteinGoal, setProteinGoal] = useState(initial.proteinGoal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      await saveProfilePatch({ dailyCalorieGoal, proteinGoal });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We couldn’t save your settings right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionLayout
      title="Nutrition targets"
      description="Make your calorie and protein targets easy to tune as your schedule, appetite, or training changes."
      badge={<SaveState saving={saving} savedLabel={saved ? 'Saved' : 'Unsaved'} error={error} />}
    >
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-600">
            <span>Daily calorie target</span>
            <input
              type="number"
              value={dailyCalorieGoal}
              onChange={(event) => {
                setDailyCalorieGoal(Number(event.target.value));
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Protein target</span>
            <input
              type="number"
              value={proteinGoal}
              onChange={(event) => {
                setProteinGoal(Number(event.target.value));
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          Keep targets realistic. A trustworthy app feels better when the numbers are maintainable, not aspirational noise.
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={saving || saved} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Save targets'}
          </button>
        </div>
      </section>
    </SectionLayout>
  );
}

export function PreferencesSettingsForm() {
  const [preferences, setPreferences] = useState<PreferencesState>(readStoredPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      window.localStorage.setItem('calorie-compass.preferences', JSON.stringify(preferences));
      window.sessionStorage.removeItem('calorie-compass.default-screen-applied');
      setSaved(true);
    } catch {
      setError('We couldn’t save your preferences right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const badge = useMemo(
    () => <SaveState saving={saving} savedLabel={saved ? 'Saved on this device' : 'Unsaved'} error={error} />,
    [error, saved, saving],
  );

  return (
    <SectionLayout title="Units and preferences" description="Tune how the app feels on this device, including units and your default landing screen." badge={badge}>
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-600">
            <span>Energy unit</span>
            <select
              value={preferences.energyUnit}
              onChange={(event) => {
                setPreferences((current) => ({ ...current, energyUnit: event.target.value as PreferencesState['energyUnit'] }));
                setSaved(false);
              }}
              className="app-select px-4 py-3"
            >
              <option value="calories">Calories</option>
              <option value="kilojoules">Kilojoules</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Weight unit</span>
            <select
              value={preferences.weightUnit}
              onChange={(event) => {
                setPreferences((current) => ({ ...current, weightUnit: event.target.value as PreferencesState['weightUnit'] }));
                setSaved(false);
              }}
              className="app-select px-4 py-3"
            >
              <option value="lb">Pounds</option>
              <option value="kg">Kilograms</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Height unit</span>
            <select
              value={preferences.heightUnit}
              onChange={(event) => {
                setPreferences((current) => ({ ...current, heightUnit: event.target.value as PreferencesState['heightUnit'] }));
                setSaved(false);
              }}
              className="app-select px-4 py-3"
            >
              <option value="cm">Centimeters</option>
              <option value="ft-in">Feet and inches</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Default start screen</span>
            <select
              value={preferences.defaultScreen}
              onChange={(event) => {
                setPreferences((current) => ({ ...current, defaultScreen: event.target.value as PreferencesState['defaultScreen'] }));
                setSaved(false);
              }}
              className="app-select px-4 py-3"
            >
              <option value="dashboard">Dashboard</option>
              <option value="logger">Log Meal</option>
              <option value="history">History</option>
              <option value="insights">Insights</option>
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-600">
          These preferences apply to the current phone or browser, so your default screen and unit choices stay consistent where you use the app most.
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={saving || saved} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Save preferences'}
          </button>
        </div>
      </section>
    </SectionLayout>
  );
}

export function NotificationsSettingsForm() {
  const [notifications, setNotifications] = useState<NotificationsState>(readStoredNotifications);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      window.localStorage.setItem('calorie-compass.notifications', JSON.stringify(notifications));
      setSaved(true);
    } catch {
      setError('We couldn’t save your notifications right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionLayout
      title="Notifications"
      description="Keep reminders helpful instead of noisy, with settings that feel calm on mobile."
      badge={<SaveState saving={saving} savedLabel={saved ? 'Saved on this device' : 'Unsaved'} error={error} />}
    >
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="space-y-3">
          <ToggleRow
            title="Meal reminder"
            description="Prompt a gentle check-in when you have not logged anything by the evening."
            checked={notifications.mealReminder}
            onChange={(value) => {
              setNotifications((current) => ({ ...current, mealReminder: value }));
              setSaved(false);
            }}
          />
          <ToggleRow
            title="Evening review"
            description="Offer a quick daily wrap-up so unfinished meals do not slip through."
            checked={notifications.eveningReview}
            onChange={(value) => {
              setNotifications((current) => ({ ...current, eveningReview: value }));
              setSaved(false);
            }}
          />
          <ToggleRow
            title="Weekly summary"
            description="Show a calm weekly recap with progress and consistency highlights."
            checked={notifications.weeklySummary}
            onChange={(value) => {
              setNotifications((current) => ({ ...current, weeklySummary: value }));
              setSaved(false);
            }}
          />
          <ToggleRow
            title="Quiet hours"
            description="Suppress non-urgent prompts during the hours you are likely winding down or asleep."
            checked={notifications.quietHours}
            onChange={(value) => {
              setNotifications((current) => ({ ...current, quietHours: value }));
              setSaved(false);
            }}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-600">
            <span>Reminder time</span>
            <input
              type="time"
              value={notifications.reminderTime}
              onChange={(event) => {
                setNotifications((current) => ({ ...current, reminderTime: event.target.value }));
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Quiet start</span>
            <input
              type="time"
              value={notifications.quietStart}
              onChange={(event) => {
                setNotifications((current) => ({ ...current, quietStart: event.target.value }));
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Quiet end</span>
            <input
              type="time"
              value={notifications.quietEnd}
              onChange={(event) => {
                setNotifications((current) => ({ ...current, quietEnd: event.target.value }));
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          Notification settings stay on this device so the behavior you choose here matches the phone or browser you actually use day to day.
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={saving || saved} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Save notifications'}
          </button>
        </div>
      </section>
    </SectionLayout>
  );
}

export function AccountSettingsForm({ initial }: { initial: ProfileSettingsSnapshot }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [nutritionPreferences, setNutritionPreferences] = useState(initial.nutritionPreferences ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dataActionNotice, setDataActionNotice] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      await saveProfilePatch({ name, nutritionPreferences });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We couldn’t save your settings right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    setExporting(true);
    setDataActionNotice(null);

    try {
      const response = await fetch('/api/profile/export');
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error('We couldn’t export your data right now. Please try again.');
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calorie-compass-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDataActionNotice('Export ready. Your meal history snapshot downloaded as JSON.');
    } catch {
      setDataActionNotice('We couldn’t export your data right now. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function resetDemoData() {
    if (!window.confirm('Reset meal history, favorites, and demo logs? Your profile and targets will stay in place.')) {
      return;
    }

    setResetting(true);
    setDataActionNotice(null);

    try {
      const response = await fetch('/api/profile/reset', { method: 'POST' });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? 'We couldn’t reset your demo data right now. Please try again.');
      }

      setDataActionNotice('Demo data reset. Your profile stayed intact, and the app is ready for a clean logging pass.');
      router.refresh();
    } catch {
      setDataActionNotice('We couldn’t reset your demo data right now. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <SectionLayout
      title="Account"
      description="Keep your display name, nutrition preferences, and data controls tidy without cluttering this area with settings you do not need every day."
      badge={<SaveState saving={saving} savedLabel={saved ? 'Saved' : 'Unsaved'} error={error} />}
    >
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid gap-4">
          <label className="space-y-2 text-sm text-slate-600">
            <span>Display name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
              className="app-input px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>Nutrition preferences</span>
            <textarea
              value={nutritionPreferences}
              onChange={(event) => {
                setNutritionPreferences(event.target.value);
                setSaved(false);
              }}
              className="app-textarea min-h-28 px-4 py-3"
              placeholder="Example: high protein, avoid heavy dairy, quick breakfasts on weekdays"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile status</p>
              <p className="mt-3 text-base font-semibold text-slate-950">Ready for everyday use</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Your name and nutrition preferences feed the live dashboard, logger, and history flows across the app.</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data handling</p>
              <p className="mt-3 text-base font-semibold text-slate-950">Meal data saves live</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Your meal history, favorites, and profile values continue to save through the live database-backed flow.</p>
            </div>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Link href="/onboarding" className="app-button-secondary inline-flex items-center justify-between rounded-[20px] px-4 py-4 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700">
              <span>Revisit onboarding basics</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/profile/goals" className="app-button-secondary inline-flex items-center justify-between rounded-[20px] px-4 py-4 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700">
              <span>Review goals and activity</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={save} disabled={saving || saved || !name.trim()} className="app-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Saving...' : 'Save account changes'}
            </button>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Privacy and data note</p>
            <p className="mt-2 leading-6">Meal history, favorites, and profile values stay inside your Calorie Compass account data. Export gives you a JSON backup, and reset clears demo logging data while keeping your profile and targets.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={exportData} disabled={exporting || resetting} className="app-button-secondary inline-flex items-center justify-center gap-2 rounded-[20px] px-4 py-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
              {exporting ? 'Preparing export...' : 'Export meal history'}
            </button>
            <button type="button" onClick={resetDemoData} disabled={resetting || exporting} className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
              {resetting ? 'Resetting...' : 'Reset demo data'}
            </button>
          </div>

          {dataActionNotice ? (
            <div className={`rounded-[20px] border px-4 py-3 text-sm ${dataActionNotice.includes('couldn’t') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
              {dataActionNotice}
            </div>
          ) : null}
        </div>
      </section>
    </SectionLayout>
  );
}

export function NotificationsPreviewCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
      <div className="flex items-center gap-2 text-slate-900">
        <BellRing className="h-4 w-4 text-slate-500" />
        <p className="font-semibold">Notification behavior stays calm by default</p>
      </div>
      <p className="mt-2 leading-6">Tune reminders and quiet hours without turning the app into a stream of noisy nudges.</p>
    </div>
  );
}

export function PreferencesPreviewCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
      <div className="flex items-center gap-2 text-slate-900">
        <MoonStar className="h-4 w-4 text-slate-500" />
        <p className="font-semibold">Preferences stay consistent on this device</p>
      </div>
      <p className="mt-2 leading-6">Your start screen and unit choices stick where you actually use the app, which keeps the daily flow feeling steady.</p>
    </div>
  );
}

export function GoalsPreviewCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
      <div className="flex items-center gap-2 text-slate-900">
        <Sparkles className="h-4 w-4 text-slate-500" />
        <p className="font-semibold">Goals stay connected to the rest of the app</p>
      </div>
      <p className="mt-2 leading-6">Your goal and activity choices shape targets across the dashboard, logger, and nutrition summaries.</p>
    </div>
  );
}
