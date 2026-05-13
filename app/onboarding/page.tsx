import { ActivityLevel, GoalType } from '@prisma/client';

import { OnboardingForm } from '@/components/onboarding-form';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export default async function OnboardingPage() {
  const user = await getCurrentUserWithProfile();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <section className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
        <div className="mb-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Onboarding</p>
          <h1 className="text-3xl font-semibold text-white">Set up your daily targets</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            Start simple. These basics make the dashboard useful right away, and you can fine-tune them later as Calorie Compass grows.
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
