import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { AppChrome } from '@/components/app-chrome';

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
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
