import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import LayoutContent from '@/components/LayoutContent';
import { ToastProvider } from '@/components/Toast';
import ToastConnector from '@/components/ToastConnector';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'SureOdds - 스포츠 양방 탐지',
  description: '실시간 멀티마켓 스포츠 배당 비교 + AI 예측',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SureOdds',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.className} h-dvh bg-gray-950 flex flex-col overflow-hidden`}>
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
