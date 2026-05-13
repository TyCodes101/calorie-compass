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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),transparent_28%),radial-gradient(circle_at_right,_rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,#020617_0%,#020617_42%,#06111f_100%)] pb-28 text-white">
          <header className="border-b border-white/5">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Calorie Compass</p>
                <h1 className="mt-2 text-lg font-semibold text-white">AI nutrition tracking, built to feel calm and fast.</h1>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 md:block">
                Nutrition estimates are approximate.
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
