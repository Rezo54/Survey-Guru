import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from './pwa-register';
import ThemeToggle from '../components/ThemeToggle';
import './styles.css';
import './theme.css';

export const metadata: Metadata = {
  title: 'Survey Guru',
  description: 'Discover, survey, validate and understand field coverage.',
  applicationName: 'Survey Guru'
};

export const viewport: Viewport = {
  themeColor: '#111827',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
