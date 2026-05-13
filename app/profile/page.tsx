import Link from 'next/link';
import { Bell, ChevronRight, Dumbbell, Goal, Ruler, UserRound } from 'lucide-react';

import { getCurrentUserWithProfile } from '@/lib/current-user';

const sections = [
  { label: 'Goals', icon: Goal },
  { label: 'Nutrition targets', icon: Dumbbell },
  { label: 'Units and preferences', icon: Ruler },
  { label: 'Notifications', icon: Bell },
  { label: 'Account', icon: UserRound },
];

export default async function ProfilePage() {
  const user = await getCurrentUserWithProfile();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="app-card rounded-[32px] p-6">
        <p className="app-section-label">Profile</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">Settings and goals</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Keep your targets simple, visible, and easy to adjust as your routine changes.
            </p>
          </div>
          <Link href="/onboarding" className="app-button-secondary px-4 py-2 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700">
            Edit profile
          </Link>
        </div>
      </section>

      <section className="app-card rounded-[32px] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Daily calories</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{user?.profile?.dailyCalorieGoal ?? 0}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Protein target</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{user?.profile?.proteinGoal ?? 0}g</p>
          </div>
        </div>
      </section>

      <section className="app-card rounded-[32px] p-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.label} className="flex items-center justify-between rounded-[24px] px-4 py-4 transition hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-slate-900">{section.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          );
        })}
      </section>
    </div>
  );
}
