import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MobileNav } from '@/components/mobile-nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/history',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('mobile navigation', () => {
  it('shows the centered Log Meal action with the primary destinations', () => {
    render(<MobileNav />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Log Meal')).toBeInTheDocument();
  });

  it('marks the active route in the navigation', () => {
    render(<MobileNav />);

    const historyLink = screen.getByRole('link', { name: /history/i });
    expect(historyLink.className).toMatch(/mobile-nav-item-active/);
  });

  it('keeps Log Meal as the prominent floating action', () => {
    render(<MobileNav />);

    const logMealLink = screen.getByRole('link', { name: /log meal/i });
    expect(logMealLink.className).toMatch(/mobile-nav-fab/);
  });

  it('renders the Insights tab on the right side of the logger action', () => {
    render(<MobileNav />);

    const insightsLink = screen.getByRole('link', { name: /insights/i });
    expect(insightsLink.className).toMatch(/mobile-nav-item/);
  });
});
