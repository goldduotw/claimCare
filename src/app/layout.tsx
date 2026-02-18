
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "../components/ui/toaster"

export const metadata: Metadata = {
  title: 'GoldDuo - Medical Claim Audits',
  description: 'Fix your medical billing errors for $3.99/mon',
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
      <footer className="w-full py-12 px-4 mt-20 border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm font-bold text-slate-900">Medical Advocacy AI</p>
            <p className="text-xs text-slate-500 mt-1">© 2026 GoldDuo. All rights reserved.</p>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Support</p>
            <a 
              href="mailto:sales@goldduo.com" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              sales@goldduo.com
            </a>
          </div>
        </div>
      </footer>
    </html>
  );
}
