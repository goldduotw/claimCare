
"use client";

import { useState, useEffect } from 'react';
import { BillAnalyzer } from '../components/bill-analyzer';
import { ClaimCareIcon } from '../components/icons';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import ComplianceModal from '../components/compliance-modal';

export default function Home() {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const agreed = localStorage.getItem('compliance-agreed');
    if (agreed === 'true') {
      setHasAgreed(true);
    }
  }, []);

  const handleAgree = () => {
    localStorage.setItem('compliance-agreed', 'true');
    setHasAgreed(true);
  };
  
  if (!isClient) {
    return null; // or a loading spinner
  }

  if (!hasAgreed) {
      return <ComplianceModal onAgree={handleAgree} />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6 w-full">
        <div className="flex items-center gap-2 text-lg font-medium">
          <a href="#" className="flex items-center gap-2 text-lg font-semibold text-primary-foreground">
            <div className="bg-primary rounded-md p-1.5">
              <ClaimCareIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-headline text-foreground">ClaimCare</span>
          </a>
        </div>
      </header>
{/* Add mt-16 to offset the sticky header */}
      <main className="flex-1 pt-6 px-4 md:px-8 max-w-5xl mx-auto w-full relative z-0">

        <div className="flex items-center mb-6">
          <h1 className="text-2xl font-semibold md:text-3xl font-headline">Medical Bill Audit</h1>
        </div>

        {/* This wrapper ensures the analyzer doesn't bleed into the header */}
        <div className="bg-background rounded-xl shadow-sm border p-1 relative z-[9999] pointer-events-auto">
          <BillAnalyzer /> 
        </div>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          This is a financial analysis tool. We do not provide medical advice or legal representation.
        </p>
      </footer>
    </div>
  );
}
