import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import LayoutContent from '@/components/LayoutContent';
import { ToastProvider } from '@/components/Toast';
import ToastConnector from '@/components/ToastConnector';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SureOdds - Sports Arbitrage Detection',
  description: 'Real-time multi-market sports odds comparison and arbitrage detection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} h-screen bg-gray-950 flex flex-col overflow-hidden`}>
        <ToastProvider>
          <ToastConnector />
          <AuthProvider>
            <LayoutContent>{children}</LayoutContent>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
