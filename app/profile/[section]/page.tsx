import { notFound, redirect } from 'next/navigation';

import {
  AccountSettingsForm,
  GoalsSettingsForm,
  NotificationsSettingsForm,
  NutritionTargetsForm,
  PreferencesSettingsForm,
} from '@/components/profile-settings-client';
import { buildAccountFoundationSnapshot } from '@/lib/auth-session';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { buildProfileSettingsSnapshot } from '@/lib/profile-settings';
import { profileSections, type ProfileSectionSlug } from '@/lib/profile-sections';

export const dynamic = 'force-dynamic';

function isProfileSectionSlug(value: string): value is ProfileSectionSlug {
  return profileSections.some((section) => section.slug === value);
}

export default async function ProfileSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (!isProfileSectionSlug(section)) {
    notFound();
  }

  const user = await getCurrentUserWithProfile();

  if (!user) {
    redirect('/onboarding');
  }

  const initial = buildProfileSettingsSnapshot(user);
  const account = buildAccountFoundationSnapshot(user);

  switch (section) {
    case 'goals':
      return <GoalsSettingsForm initial={initial} />;
    case 'nutrition-targets':
      return <NutritionTargetsForm initial={initial} />;
    case 'preferences':
      return <PreferencesSettingsForm />;
    case 'notifications':
      return <NotificationsSettingsForm />;
    case 'account':
      return <AccountSettingsForm initial={initial} account={account} />;
    default:
      notFound();
  }
}
