'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import { MobileNav } from '@/components/mobile-nav';

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersiveLogger = pathname.startsWith('/logger');

  return (
    <div className={clsx('app-shell text-slate-900', immersiveLogger ? 'app-shell-immersive' : 'pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-36')}>
      {!immersiveLogger ? (
        <header className="border-b border-slate-200/70 bg-white/78 backdrop-blur-xl">
          <div className="app-screen-wide flex min-w-0 items-center justify-between gap-4 py-3.5 md:py-4">
            <p className="text-sm font-semibold tracking-[-0.02em] text-slate-950">Calorie Compass</p>
          </div>
        </header>
      ) : null}

      <main className={clsx('min-w-0', immersiveLogger && 'app-main-immersive')}>{children}</main>
      {!immersiveLogger ? <MobileNav /> : null}
    </div>
  );
}
