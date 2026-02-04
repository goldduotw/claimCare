
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "../components/ui/toaster"

export const metadata: Metadata = {
  title: 'GoldDuo - Medical Claim Audits',
  description: 'Fix your medical billing errors for $2.99',
  icons: {
    icon: '/icon.png', // The browser will scale this for the tab
    apple: '/icon.png', // Specifically for iPhone/iPad home screens
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased">

          {children}
          <Toaster />

      </body>
    </html>
  );
}
