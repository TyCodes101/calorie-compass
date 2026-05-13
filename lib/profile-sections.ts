export const profileSections = [
  {
    slug: 'goals',
    label: 'Goals',
    description: 'Choose the goal and activity pace that should shape your day.',
  },
  {
    slug: 'nutrition-targets',
    label: 'Nutrition targets',
    description: 'Adjust your calorie and protein targets without redoing onboarding.',
  },
  {
    slug: 'preferences',
    label: 'Units and preferences',
    description: 'Set how the app should display units, energy, and your default start screen.',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    description: 'Control reminders, summaries, and quiet hours without making the app noisy.',
  },
  {
    slug: 'account',
    label: 'Account',
    description: 'Keep your name and account details tidy in one simple place.',
  },
] as const;

export type ProfileSectionSlug = (typeof profileSections)[number]['slug'];
