"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { BillAnalyzer } from "../../../components/bill-analyzer"; 
import { Loader2 } from "lucide-react";

export default function AuditPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

const fetchAudit = useCallback(async () => {
  if (!id) return;

  // We attempt to fetch the audit
  const { data: auditData, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // This is the "Muzzle" for your phone
    const isAuthError = error.code === 'PGRST301' || error.message?.includes("Unauthorized");
    
    if (isAuthError) {
      // If we are unauthorized, it just means we are a Guest.
      // We don't stop; we just let the app continue as a guest.
      console.log("Guest view detected in page.tsx");
      setLoading(false); 
      return false; 
    }
    console.error("Fetch error:", error.message);
  }

  if (auditData) {
    setData(auditData);
    setLoading(false);
    return true;
  }
  return false;
}, [id]);

  useEffect(() => {
    // Initial fetch
    fetchAudit().then((found) => {
      if (!found && retryCount < 5) {
        // If not found, wait 2 seconds and try again (up to 5 times)
        const timer = setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
        return () => clearTimeout(timer);
      } else if (retryCount >= 5) {
        setLoading(false);
      }
    });
  }, [id, retryCount, fetchAudit]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-2" />
        <p className="text-slate-500 font-medium">Verifying Payment & Finalizing Report...</p>
        <p className="text-xs text-slate-400 mt-1">This may take a few seconds.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-20 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Report Not Found</h1>
        <p className="text-slate-500 mt-2">We couldn't find your audit yet. If you just paid, please wait a moment and refresh.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  const isSubscribed = data.status === 'paid' || data.status === 'active' || searchParams.get('success') === 'true';

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <BillAnalyzer 
          initialData={{
            markdown: data.analysis_table || "",
            totalBilled: parseFloat(data.billed_amount || "0"),
            totalExpected: parseFloat(data.expected_amount || "0"),
            reasoning: data.reasoning || "",
            patientName: data.patient_name || "",
            id: data.id 
          }}
          isUnlocked={isSubscribed} 
        />
      </div>
    </main>
  );
}