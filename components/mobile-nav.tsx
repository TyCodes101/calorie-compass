'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, LayoutDashboard, Sparkles, UserRound } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/logger', label: 'AI Logger', icon: Sparkles },
  { href: '/onboarding', label: 'Onboarding', icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-xl items-center justify-around rounded-t-3xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-xl md:left-6 md:right-6 md:bottom-6 md:rounded-3xl">
      <div className="absolute -top-5 left-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg">
        <Compass className="h-5 w-5" />
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex min-w-20 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition',
              active ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
