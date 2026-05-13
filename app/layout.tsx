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
        <div className="app-shell pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-slate-900 md:pb-40">
          <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
              <div>
                <p className="app-section-label">Calorie Compass</p>
                <h1 className="mt-2 text-lg font-semibold text-slate-950">Nutrition tracking that feels calm, clear, and trustworthy.</h1>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm md:block">
                Verified when trusted sources are available.
              </div>
            </div>
          </header>
          <main>{children}</main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
