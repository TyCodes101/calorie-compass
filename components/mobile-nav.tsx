'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Clock3, House, Plus, UserRound } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/history', label: 'History', icon: Clock3 },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/profile', label: 'Profile', icon: UserRound },
] as const;

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

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      onClick={triggerHapticFeedback}
      aria-current={active ? 'page' : undefined}
      className={clsx('mobile-nav-item', active && 'mobile-nav-item-active')}
    >
      <span className="mobile-nav-item-indicator" aria-hidden="true" />
      <span className="mobile-nav-item-icon-wrap" aria-hidden="true">
        <Icon className="mobile-nav-item-icon" />
      </span>
      <span className="mobile-nav-item-label">{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [dashboard, history, insights, profile] = items;
  const loggerActive = pathname.startsWith('/logger');

  return (
    <nav className="mobile-nav" aria-label="Primary">
      <NavItem {...dashboard} active={matchesPath(pathname, dashboard.href)} />
      <NavItem {...history} active={matchesPath(pathname, history.href)} />
      <span className="mobile-nav-center-spacer" aria-hidden="true" />
      <NavItem {...insights} active={matchesPath(pathname, insights.href)} />
      <NavItem {...profile} active={matchesPath(pathname, profile.href)} />

      <Link
        href="/logger"
        aria-label="Log Meal"
        aria-current={loggerActive ? 'page' : undefined}
        onClick={triggerHapticFeedback}
        className={clsx('mobile-nav-fab', loggerActive && 'mobile-nav-fab-active')}
      >
        <span className="mobile-nav-fab-glow" aria-hidden="true" />
        <span className="mobile-nav-fab-icon">
          <Plus className="h-[18px] w-[18px]" />
        </span>
        <span className="mobile-nav-fab-label">Log Meal</span>
      </Link>
    </nav>
  );
}
