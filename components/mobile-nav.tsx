'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, House, Plus, UserRound } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/', label: 'Home', icon: House },
  { href: '/history', label: 'History', icon: Clock3 },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-xl items-end justify-between rounded-t-[28px] border border-slate-200 bg-white/95 px-6 pb-4 pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:bottom-6 md:rounded-[28px]">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition',
              active ? 'bg-slate-900 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <Link
        href="/logger"
        aria-label="Log Meal"
        className={clsx(
          'absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-[24px] border border-teal-200 bg-gradient-to-b from-teal-500 to-cyan-500 px-5 py-3 text-xs font-semibold text-white shadow-[0_14px_32px_rgba(20,184,166,0.35)] transition hover:scale-[1.01]',
          pathname.startsWith('/logger') && 'ring-4 ring-teal-100'
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <Plus className="h-4 w-4" />
        </span>
        <span>Log Meal</span>
      </Link>
    </nav>
  );
}
