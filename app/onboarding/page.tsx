import { ActivityLevel, GoalType } from '@prisma/client';

import { OnboardingForm } from '@/components/onboarding-form';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUserWithProfile();

  return (
    <div className="app-page mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <section className="app-card rounded-[32px] p-6">
        <div className="mb-6 space-y-3">
          <p className="app-section-label">Onboarding</p>
          <h1 className="text-3xl font-semibold text-slate-950">A lighter start for daily nutrition tracking</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Start simple. These basics make the dashboard useful right away, and your first AI meal log is right on the other side.
          </p>
        </div>
        <OnboardingForm
          initial={{
            name: user?.name,
            age: user?.profile?.age,
            heightCm: user?.profile?.heightCm,
            weightLbs: user?.profile?.weightLbs,
            goal: (user?.profile?.goal as keyof typeof GoalType | undefined) ?? 'LOSE_WEIGHT',
            activityLevel: (user?.profile?.activityLevel as keyof typeof ActivityLevel | undefined) ?? 'MODERATE',
            dailyCalorieGoal: user?.profile?.dailyCalorieGoal,
            proteinGoal: user?.profile?.proteinGoal,
          }}
        />
      </section>
    </div>
  );
}
