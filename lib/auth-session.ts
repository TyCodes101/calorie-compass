export const guestSessionCookieName = 'cc_guest_session';
const guestEmailDomain = 'guest.caloriecompass.local';
const guestPlaceholderName = 'Guest';

export type SessionUserLike = {
  id?: string;
  name?: string | null;
  email?: string | null;
  demo?: boolean | null;
  profile?: unknown;
} | null;

export type AccountFoundationSnapshot = {
  mode: 'guest' | 'account';
  title: string;
  description: string;
  persistenceLabel: string;
  providers: {
    id: 'apple' | 'google';
    label: string;
    status: 'planned';
    detail: string;
  }[];
};

export function buildGuestUserEmail(sessionId: string) {
  return `${sessionId}@${guestEmailDomain}`;
}

export function isGuestEmail(email: string | null | undefined) {
  return Boolean(email && email.endsWith(`@${guestEmailDomain}`));
}

export function isGuestUser(user: SessionUserLike) {
  return Boolean(user && user.demo !== false && (isGuestEmail(user.email) || !user.email));
}

export function getPreferredUserName(user: SessionUserLike) {
  const trimmed = user?.name?.trim();
  if (!trimmed) {
    return null;
  }

  if (isGuestUser(user) && trimmed.toLowerCase() === guestPlaceholderName.toLowerCase()) {
    return null;
  }

  return trimmed;
}

export function getGuestPlaceholderName() {
  return guestPlaceholderName;
}

export function buildAccountFoundationSnapshot(user: SessionUserLike): AccountFoundationSnapshot {
  const guestMode = isGuestUser(user);

  return {
    mode: guestMode ? 'guest' : 'account',
    title: guestMode ? 'Guest mode is active' : 'Account session is active',
    description: guestMode
      ? 'Your meals, favorites, goals, and profile stay tied to this device session right now, so the app already feels persistent without making sign-in mandatory.'
      : 'Your meals, favorites, goals, and profile are already tied to your account session.',
    persistenceLabel: guestMode ? 'Live guest session with saved history' : 'Live account-backed history',
    providers: [
      {
        id: 'apple',
        label: 'Continue with Apple',
        status: 'planned',
        detail: 'Native Apple sign-in can request a backend-issued session; account-management polish and real-device auth QA remain before public auth readiness.',
      },
      {
        id: 'google',
        label: 'Continue with Google',
        status: 'planned',
        detail: 'Architecture is ready for Google sign-in wiring when provider credentials are added.',
      },
    ],
  };
}
