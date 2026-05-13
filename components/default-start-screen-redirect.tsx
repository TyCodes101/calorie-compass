'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const sessionKey = 'calorie-compass.default-screen-applied';
const storageKey = 'calorie-compass.preferences';
const routeMap = {
  dashboard: '/',
  logger: '/logger',
  history: '/history',
  insights: '/insights',
} as const;

export function DefaultStartScreenRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(sessionKey) === '1') {
        return;
      }

      const stored = window.localStorage.getItem(storageKey);
      const defaultScreen = stored ? JSON.parse(stored)?.defaultScreen : 'dashboard';
      const nextRoute = routeMap[defaultScreen as keyof typeof routeMap] ?? '/';

      window.sessionStorage.setItem(sessionKey, '1');

      if (nextRoute !== '/') {
        router.replace(nextRoute);
      }
    } catch {
      window.sessionStorage.setItem(sessionKey, '1');
    }
  }, [router]);

  return null;
}
