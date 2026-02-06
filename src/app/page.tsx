"use client";

import { useState, useEffect } from 'react';
import { BillAnalyzer } from '../components/bill-analyzer';
import { ClaimCareIcon } from '../components/icons';
import { supabase } from '../lib/supabaseClient'; 
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

    // This listens for the moment you return from Google
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        console.log("Auth session detected after redirect");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAgree = () => {
    localStorage.setItem('compliance-agreed', 'true');
    setHasAgreed(true);
  };
  
  if (!isClient) return null;
  if (!hasAgreed) return <ComplianceModal onAgree={handleAgree} />;

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6 w-full">
        <div className="flex items-center gap-2 text-lg font-medium">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <div className="bg-primary rounded-md p-1.5">
              <ClaimCareIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-headline text-foreground">ClaimCare</span>
          </div>
        </div>
      </header>
      <main className="flex-1 pt-6 px-4 md:px-8 max-w-5xl mx-auto w-full relative z-0">
        <div className="flex items-center gap-3 mb-8">
          <img src="/icon.png" alt="Logo" className="w-14 h-14 object-contain"/>
          <h1 className="text-2xl font-semibold md:text-3xl font-headline text-slate-900">Medical Bill Audit</h1>
        </div>
        <div className="bg-background rounded-xl shadow-sm border p-1 relative z-[9999]">
          <BillAnalyzer /> 
        </div>
      </main>
    </div>
  );
}