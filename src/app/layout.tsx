import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { RegisterSW } from '@/components/pwa/register-sw'

// PT Sans is loaded with a plain stylesheet link instead of next/font/google so
// that `next build` works in offline environments (CI, sandboxes). The stack in
// globals.css falls back to the system UI font when Google Fonts is unreachable.
const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1e3a5f',
}

export const metadata: Metadata = {
  title: 'FaidaFleet',
  description: 'Fleet management for matatu and logistics operators in Kenya.',
  applicationName: 'FaidaFleet',
  appleWebApp: {
    capable: true,
    title: 'FaidaFleet',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body className="font-body antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('faidafleet-theme');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`}
        </Script>
        {children}
        <Toaster />
        <RegisterSW />
      </body>
    </html>
  );
}
