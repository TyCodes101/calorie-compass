import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { MobileNav } from '@/components/mobile-nav';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Calorie Compass',
  description: 'AI-powered nutrition tracking with confirmation-first meal logging.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="app-shell pb-[calc(9.5rem+env(safe-area-inset-bottom))] text-slate-900 md:pb-36">
          <header className="border-b border-slate-200/70 bg-white/76 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div className="app-screen-wide flex min-w-0 items-center justify-between gap-4 py-5 md:py-6">
              <div className="min-w-0">
                <p className="app-section-label">Calorie Compass</p>
                <h1 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950 md:text-[1.15rem]">
                  Nutrition tracking that feels calm, clear, and trustworthy.
                </h1>
              </div>
              <div className="hidden rounded-full border border-white/90 bg-white/92 px-4 py-2 text-sm text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.07)] md:block">
                Verified when trusted sources are available.
              </div>
            </div>
          </header>
          <main className="min-w-0">{children}</main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
