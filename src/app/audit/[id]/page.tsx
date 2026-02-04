"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from '../../../lib/supabaseClient';

export default function AuditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function PageSetup() {
      if (!id) return;

      // 1. Get the current user
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Fetch the Audit and the User's Subscription Profile in parallel
      const [auditResponse, profileResponse] = await Promise.all([
        supabase.from('audits').select('*').eq('id', id).single(),
        user ? supabase.from('profiles').select('subscription_status').eq('id', user.id).single() : { data: null }
      ]);

      if (auditResponse.data) {
        setData(auditResponse.data);
      }

      // 3. Logic: Unlocked if they have an active subscription OR if this specific audit was manually unlocked
      const activeMember = profileResponse.data?.subscription_status === 'active';
      const individuallyPaid = auditResponse.data?.is_unlocked === true;
      
      setIsSubscribed(activeMember || individuallyPaid);
      setLoading(false);
    }

    PageSetup();
  }, [id]);

  if (loading) return <div className="p-20 text-center">Loading your report...</div>;
  if (!data) return <div className="p-20 text-center">Audit report not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen shadow-lg relative">
      <h1 className="text-3xl font-bold mb-2">Medical Advocacy Report</h1>
      <p className="text-gray-500 mb-8 border-b pb-4">Patient: {data.details?.patientName || "Valued Patient"}</p>
      
      {/* 2. The Main Stats Section (Always Visible) */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-red-50 rounded-xl border border-red-100">
            <p className="text-sm text-red-600 uppercase font-bold">Original Bill</p>
            <p className="text-4xl font-black text-red-700">{data.billed_amount || data.details?.billedAmount || "$0.00"}</p>
        </div>
        <div className="p-6 bg-green-50 rounded-xl border border-green-100">
            <p className="text-sm text-green-600 uppercase font-bold">Recommended Co-pay</p>
            <p className="text-4xl font-black text-green-700">{data.expected_amount || data.details?.expectedAmount || "$0.00"}</p>
        </div>
      </div>

      {/* 3. The Blurred Section Logic */}
      <div className="mt-10 relative">
        <h3 className="text-xl font-bold mb-4">Line Item Analysis</h3>
        
        <div className={`border rounded-lg overflow-hidden transition-all duration-500 ${!isSubscribed ? 'blur-md select-none pointer-events-none' : ''}`}>
            <p className="p-4 text-gray-700 whitespace-pre-wrap">
                {data.analysis || data.analysisTable || "No detailed analysis available."}
            </p>
        </div>

        {/* 4. The Subscription Overlay */}
        {!isSubscribed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-sm rounded-lg border-2 border-dashed border-blue-400 p-8 text-center">
            <h4 className="text-2xl font-bold text-gray-900 mb-2">Advocacy Card Locked</h4>
            <p className="text-gray-600 mb-6 max-w-sm">
              We found potential savings! Subscribe for <strong>$3.99/mo</strong> to unlock unlimited audit reports and expert language.
            </p>
            <button 
              onClick={() => router.push('/subscribe')} // Direct to your new subscription checkout page
              className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-blue-700 shadow-xl"
            >
              Unlock with Monthly Subscription
            </button>
          </div>
        )}
      </div>
    </div>
  );
}