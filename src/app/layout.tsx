import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { RegisterSW } from '@/components/pwa/register-sw'

// Self-hosted PT Sans (SIL OFL 1.1, see src/fonts/ptsans/OFL.txt).
// Local fonts keep production builds hermetic and remove the runtime
// dependency on Google Fonts, which matters for the offline-first PWA.
const ptSans = localFont({
  src: [
    { path: '../fonts/ptsans/PT_Sans-Web-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/ptsans/PT_Sans-Web-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-pt-sans',
  display: 'swap',
});

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
    <html lang="en" suppressHydrationWarning className={ptSans.variable}>
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
