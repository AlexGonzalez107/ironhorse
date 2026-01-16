import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { Nav } from '@/components/nav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Iron Horse - Deal Intelligence',
  description: 'Real estate deal pipeline and market intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-slate-900 text-slate-100 min-h-screen`}
        suppressHydrationWarning
      >
        <StoreProvider>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
