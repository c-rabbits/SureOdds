import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SureOdds - Sports Arbitrage Betting',
  description: 'Real-time sports odds comparison and arbitrage (sure bet) detection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-gray-950`}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-gray-800 mt-16 py-8 text-center text-gray-500 text-sm">
          <p>SureOdds &copy; {new Date().getFullYear()} &mdash; For educational purposes only. Bet responsibly.</p>
        </footer>
      </body>
    </html>
  );
}
