import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, ChevronRight, Dumbbell, Goal, Ruler, UserRound } from 'lucide-react';

import { GoalsPreviewCard, NotificationsPreviewCard, PreferencesPreviewCard } from '@/components/profile-settings-client';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { profileSections } from '@/lib/profile-sections';

export const dynamic = 'force-dynamic';

const sectionIcons = {
  goals: Goal,
  'nutrition-targets': Dumbbell,
  preferences: Ruler,
  notifications: Bell,
  account: UserRound,
} as const;

export default async function ProfilePage() {
  const user = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/onboarding');
  }

  return (
    <div className="app-page app-screen-narrow flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <p className="app-section-label">Profile</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">Settings and goals</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Keep your goals, defaults, reminders, and account details cleanly tuned without leaving the calm day-to-day logging flow.
            </p>
          </div>
          <Link href="/onboarding" className="app-button-secondary inline-flex w-full items-center justify-center px-4 py-3 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700 sm:w-auto">
            Edit onboarding basics
          </Link>
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Daily calories</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{user?.profile?.dailyCalorieGoal ?? 0}</p>
            <p className="mt-2 text-sm text-slate-500">Current steady target</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Protein target</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{user?.profile?.proteinGoal ?? 0}g</p>
            <p className="mt-2 text-sm text-slate-500">Used across dashboard and review flows</p>
          </div>
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-2">
        {profileSections.map((section) => {
          const Icon = sectionIcons[section.slug];
          return (
            <Link
              key={section.slug}
              href={`/profile/${section.slug}`}
              className="flex items-center justify-between gap-4 rounded-[24px] px-4 py-4 transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-900">{section.label}</span>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <GoalsPreviewCard />
        <PreferencesPreviewCard />
        <NotificationsPreviewCard />
      </section>
    </div>
  );
}
