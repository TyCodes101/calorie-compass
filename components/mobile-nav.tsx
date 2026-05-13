'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, House, Plus, UserRound } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/history', label: 'History', icon: Clock3 },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

function matchesPath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname.startsWith(href);
}

function triggerHapticFeedback() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8);
  }
}

export function MobileNav() {
  const pathname = usePathname();
  const [dashboard, history, profile] = items;
  const loggerActive = pathname.startsWith('/logger');
  const ProfileIcon = profile.icon;

  return (
    <nav className="mobile-nav" aria-label="Primary">
      {[dashboard, history].map((item) => {
        const Icon = item.icon;
        const active = matchesPath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={triggerHapticFeedback}
            className={clsx('mobile-nav-item', active && 'mobile-nav-item-active')}
          >
            <Icon className="mobile-nav-item-icon" />
            <span className="mobile-nav-item-label">{item.label}</span>
          </Link>
        );
      })}

      <Link
        href="/logger"
        aria-label="Log Meal"
        onClick={triggerHapticFeedback}
        className={clsx('mobile-nav-fab', loggerActive && 'mobile-nav-fab-active')}
      >
        <span className="mobile-nav-fab-glow" aria-hidden="true" />
        <span className="mobile-nav-fab-icon">
          <Plus className="h-5 w-5" />
        </span>
        <span className="mobile-nav-fab-label">Log Meal</span>
      </Link>

      <Link
        href={profile.href}
        onClick={triggerHapticFeedback}
        className={clsx('mobile-nav-item', matchesPath(pathname, profile.href) && 'mobile-nav-item-active')}
      >
        <ProfileIcon className="mobile-nav-item-icon" />
        <span className="mobile-nav-item-label">{profile.label}</span>
      </Link>
    </nav>
  );
}
