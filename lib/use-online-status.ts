'use client';

import { useEffect, useState } from 'react';

async function confirmOffline() {
  if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
    return false;
  }

  if (typeof fetch !== 'function') {
    return true;
  }

  try {
    await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
    return false;
  } catch {
    return true;
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refreshOnlineStatus() {
      const offline = await confirmOffline();
      if (!cancelled) {
        setIsOnline(!offline);
      }
    }

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      void refreshOnlineStatus();
    }

    void refreshOnlineStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
