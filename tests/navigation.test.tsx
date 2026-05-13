import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MobileNav } from '@/components/mobile-nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/history',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('mobile navigation', () => {
  it('shows the emphasized Log Meal action with the primary destinations', () => {
    render(<MobileNav />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Log Meal')).toBeInTheDocument();
  });

  it('marks the active route in the navigation', () => {
    render(<MobileNav />);

    const historyLink = screen.getByRole('link', { name: /history/i });
    expect(historyLink.className).toMatch(/bg-slate-900/);
  });
});
