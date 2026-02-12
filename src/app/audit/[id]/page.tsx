"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { BillAnalyzer } from "../../../components/bill-analyzer"; 
import { Loader2 } from "lucide-react";

export default function AuditPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    async function PageSetup() {
      if (!id) return;

      const { data: auditData } = await supabase
        .from('audits')
        .select('*')
        .eq('id', id)
        .single();

      if (auditData) {
        setData(auditData);
        
        // Use URL 'success' flag to bypass DB lag after Stripe payment
        const searchParams = new URLSearchParams(window.location.search);
        const wasSuccess = searchParams.get('success') === 'true';
        const isPaidInDb = auditData.status === 'paid' || auditData.status === 'active';
        
        setIsSubscribed(isPaidInDb || wasSuccess);
      }
      
      setLoading(false);
    }

    PageSetup();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-2" />
        <p className="text-slate-500">Loading Report...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-20 text-center font-bold">Audit report not found.</div>;
  }

return (
    <main className="container mx-auto py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <BillAnalyzer 
          initialData={{
            // Try every possible column name from your DB
            markdown: data.analysis_table || data.markdown || "",
            totalBilled: parseFloat(data.billed_amount || data.totalBilled || "0"),
            totalExpected: parseFloat(data.expected_amount || data.totalExpected || "0"),
            reasoning: data.reasoning || "",
            patientName: data.patient_name || data.patientName || "",
            // Add the raw ID so handleUnlock knows which record to update
            id: data.id 
          }}
          isUnlocked={isSubscribed} 
        />
      </div>
    </main>
  );
}