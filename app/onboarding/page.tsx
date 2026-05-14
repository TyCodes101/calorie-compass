import { ActivityLevel, GoalType } from '@prisma/client';

import { OnboardingForm } from '@/components/onboarding-form';
import { getPreferredUserName } from '@/lib/auth-session';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUserWithProfile();

  return (
    <div className="app-page app-screen-narrow min-w-0 space-y-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="mb-6 space-y-3">
          <p className="app-section-label">Onboarding</p>
          <h1 className="text-3xl font-semibold text-slate-950">A lighter start for daily nutrition tracking</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Start simple. These basics make the dashboard useful right away, and your first AI meal log is right on the other side.
          </p>
        </div>
        <OnboardingForm
          initial={{
            name: getPreferredUserName(user) ?? undefined,
            age: user?.profile?.age,
            heightCm: user?.profile?.heightCm,
            weightLbs: user?.profile?.weightLbs,
            goal: (user?.profile?.goal as keyof typeof GoalType | undefined) ?? 'LOSE_WEIGHT',
            activityLevel: (user?.profile?.activityLevel as keyof typeof ActivityLevel | undefined) ?? 'MODERATE',
            dailyCalorieGoal: user?.profile?.dailyCalorieGoal,
            proteinGoal: user?.profile?.proteinGoal,
            nutritionPreferences: user?.profile?.aiPreferenceNotes,
          }}
        />
      </section>
    </div>
  );
}
