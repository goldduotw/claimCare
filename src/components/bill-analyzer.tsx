"use client";

import { useParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient'; 
import { useState, useTransition, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { analyzeBill } from '../app/actions';
import { Loader2, AlertTriangle, Lightbulb, Download, Camera, X, FileText, PlusCircle, UserSquare, TestTube2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ReceptionistViewModal, DiscrepancyDetails } from './receptionist-view-modal';
import { useToast } from '../hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Lock, ChevronRight,Printer } from "lucide-react";
import remarkGfm from "remark-gfm";

// Feature 1: Import the rate limit action
import { checkRateLimit } from '../app/actions'; 

interface BillAnalyzerProps {
  initialData?: any; 
  isUnlocked?: boolean;
}

interface AnalysisResult {
  markdown: string;
  totalBilled: number;    
  totalExpected: number;  
  reasoning?: string; // Add this line
  patientName?: string;
  discrepancyDetails?: {
    patientName?: string;
    expectedAmount?: string;
    billedAmount?: string;
    planReference?: string;
    reasoning?: string; // Add this line too
  };
}

// Simple markdown table parser
function parseMarkdownTable(markdown: string): { headers: string[], rows: string[][] } {
  console.log("!!! PARSER TRIGGERED !!!");

  if (!markdown || !markdown.trim()) {
    console.log("PARSER EXIT: Markdown was empty.");
    return { headers: [], rows: [] };
  }
  
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const separatorIndex = lines.findIndex(line => 
    line.includes('|') && line.includes('-') && /^\|?[\s\-|:\|]+\|?$/.test(line)
  );

  if (separatorIndex < 1) {
    console.log("PARSER EXIT: No separator found.");
    return { headers: [], rows: [] };
  }

  const headers = lines[separatorIndex - 1].split('|')
    .map(h => h.trim())
    .filter((cell, i, arr) => !((i === 0 || i === arr.length - 1) && cell === ""));

  const rows = lines.slice(separatorIndex + 1)
    .filter(line => line.includes('|'))
    .map(line => {
      const cells = line.split('|').map(c => c.trim());
      return cells.slice(line.startsWith('|') ? 1 : 0, line.endsWith('|') ? -1 : undefined);
    });

  // --- NEW: LOG EVERY SINGLE ROW ---
  console.log(`TOTAL ROWS DETECTED: ${rows.length}`);
  rows.forEach((row, index) => {
    console.log(`ROW ${index + 1} DATA:`, row);
  });

  return { headers, rows };
}

const sampleDiscrepancyForTesting: DiscrepancyDetails = {
    patientName: 'Test Patient',
    expectedAmount: '$20.00',
    billedAmount: '$100.00',
    planReference: 'Page 4, Co-payment section'
};
export function BillAnalyzer({ initialData, isUnlocked: externalIsUnlocked }: BillAnalyzerProps) {
  const router = useRouter();
  const [actualId, setActualId] = useState<string | null>(null);
  const params = useParams();
  const auditId = params?.id as string;

  const [billText, setBillText] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [insurancePdfData, setInsurancePdfData] = useState<string | null>(null);
  const [insurancePdfFile, setInsurancePdfFile] = useState<File | null>(null);
 // const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(initialData || null);
  const [error, setError] = useState<string | null>(null);
//  const [isPending, startTransition] = useTransition();
  const [isPending, setIsPending] = useState(false);
  const [showInsuranceUpload, setShowInsuranceUpload] = useState(false);
  const [showReceptionistView, setShowReceptionistView] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(externalIsUnlocked || false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [viewMode, setViewMode] = useState<'report' | 'letter'>('report');
  const analysisRef = useRef<HTMLDivElement>(null);
  const billFileInputRef = useRef<HTMLInputElement>(null);
  const insuranceFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);

useEffect(() => {
  if (initialData) {
    console.log("CHECKPOINT 3 - Data Received:", initialData);

    // This ensures we try every possible name the database might send
    const rawMarkdown = initialData.analysis_table || initialData.markdown || "";

    const fixedMarkdown = rawMarkdown
      .replace(/\\n/g, '\n')
      .replace(/\|(\s*)\|/g, "|\n|");

    setAnalysisResult({
      markdown: fixedMarkdown || "No table data found for this audit.",
      totalBilled: initialData.billed_amount || initialData.totalBilled || 0,
      totalExpected: initialData.expected_amount || initialData.totalExpected || 0,
      reasoning: initialData.reasoning || "Medical billing discrepancy detected.",
      patientName: initialData.patient_name || initialData.patientName || ""
    });
  }
}, [initialData]);

const handleVFDClick = () => {
    console.log("VFD Clicked - EXECUTION START");
    
    // We remove the 700ms timeout entirely. 
    // We remove setIsTransitioning(true) to prevent the UI from "hiding".
    if (!isUnlocked) {
      console.log("Status: Locked - TRIGGERING PAYWALL NOW");
      setShowPaywall(true); 
      setIsTransitioning(false); // Force this to false to ensure visibility
    } else {
      console.log("Status: Unlocked - TRIGGERING RECEPTIONIST NOW");
      setShowReceptionistView(true);
      setIsTransitioning(false);
    }
  };

// Feature 3: Deferred Write - Hits Supabase ONLY on Unlock
// Inside your BillAnalyzer component, replace handleUMSUnlock with this:

const handleUMSUnlock = async (passedUser?: any) => {
  setIsSubscribing(true);
  setError(null);

  try {
    // 1. Force a session refresh to be 100% sure
    const { data: { session } } = await supabase.auth.getSession();
    const user = passedUser || session?.user;

    // GATE 1: No user? Go to Google and STOP.
    if (!user) {
      console.log("No session. Saving data and moving to Google...");
      if (analysisResult) {
        localStorage.setItem('pending_audit', JSON.stringify(analysisResult));
      }
      
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('triggerCheckout', 'true');
      
      await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { redirectTo: currentUrl.toString() } 
      });

      return; // <--- This prevents the 401 error below
    }

    // GATE 2: Double-check logic for Stripe
    console.log("Session verified. Calling Stripe API...");
    let finalAuditId = initialData?.id || currentAuditId;

    // Use a try/catch specifically for the API call to handle the 401 gracefully
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId: finalAuditId,
        billedAmount: analysisResult?.totalBilled,
        analysisMarkdown: analysisResult?.markdown,
        mode: 'subscription' 
      }),
    });

    if (response.status === 401) {
       throw new Error("Session expired. Please sign in again.");
    }

    const sessionData = await response.json();
    if (sessionData.url) {
      window.location.href = sessionData.url;
    } else {
      throw new Error(sessionData.error || "Stripe Session Failed");
    }

  } catch (err: any) {
    console.error("Critical Flow Error:", err);
    setIsSubscribing(false);
    // Only show the error if we aren't currently redirecting
    setError(err.message || "Connection Error. Please try again.");
  }
};

// Feature 1: IP Rate Limit inside handleAudit
// Find the handleAudit function in your file and replace it with this:
const handleAudit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setError(null);

  // --- ADDED PROTECTION SWITCH ---
  const isAllowed = await checkRateLimit();
  if (!isAllowed) {
    setError("Rate limit exceeded. Please wait 15 minutes before trying again.");
    return;
  }
  // -------------------------------

  setIsPending(true);

  try {
    const analysisInput = { 
      billText: imageData ? '' : billText, 
      imageData, 
      insurancePdfData 
    };

    const result = await analyzeBill(analysisInput);

    if (result.success) {
      // THIS BLOCK TRIGGERS THE TEASER
      setAnalysisResult({
        markdown: result.data.analysisMarkdown || '', // Ensure this matches your AI output key
        totalBilled: result.totalBilled,
        totalExpected: result.totalExpected,
        reasoning: result.reasoning,
        patientName: result.patientName || "" 
      });
    } else {
      setError(result.error || "An error occurred.");
    }
  } catch (e: any) {
    setError(e.message || "An unexpected error occurred.");
  } finally {
    setIsPending(false);
  }
};

// Also verify your renderAnalysis alert block uses these names:
// <span>Billed: ${analysisResult?.totalBilled?.toFixed(2)}</span>
// <span className="text-green-700 font-bold">Fair Price: ${analysisResult?.totalExpected?.toFixed(2)}</span>

const handleSaveAudit = async (analysisResult: any) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('audits')
    .insert([{
      patient_name: "", 
      billed_amount: analysisResult.totalBilled,
      expected_amount: analysisResult.fairPrice,
      analysis_table: analysisResult.analysisTable,
      status: 'pending',
      is_unlocked: false,
      user_id: user?.id || null 
    }])
    .select()
    .single();

  if (data) {
    router.push(`/audit/${data.id}`);
  }
};

const fetchAudit = async (id: string) => {
  // 1. We go to the DB and grab every column
  const { data, error } = await supabase
    .from('audits')
    .select('analysis_table, billed_amount, expected_amount, reasoning, patient_name, status') 
    .eq('id', id)
    .single();

  // 2. If the Webhook did its job, status is now 'paid'
  if (data && (data.status === 'paid' || data.status === 'active')) {
    setAnalysisResult({
      markdown: data.analysis_table || '', 
      totalBilled: parseFloat(data.billed_amount || "0"), 
      totalExpected: parseFloat(data.expected_amount || "0"),
      // 3. We pull the 'Test' string and 'AI Name' we saved earlier
      reasoning: data.reasoning || '', 
      patientName: data.patient_name || '' 
    });
    
    setIsUnlocked(true); // This removes the blur/masking
    setShowPaywall(false); // This removes the UMS/VFD buttons
  }
};

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const shouldCheckout = params.get('triggerCheckout');
  const savedData = localStorage.getItem('pending_audit');

  const resumeFlow = async () => {
    // Wait for the session to be fully picked up by the Supabase client
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user && shouldCheckout === 'true' && savedData) {
      console.log("Returned from Google. Resuming checkout...");
      const data = JSON.parse(savedData);
      setAnalysisResult(data);
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('triggerCheckout');
      window.history.replaceState({}, '', newUrl.toString());

      // Pass the user directly to ensure Gate 1 is passed
      handleUMSUnlock(session.user);
      localStorage.removeItem('pending_audit');
    }
  };

  resumeFlow();
}, [initialData]);

const uploadBill = async (dataUrl: string): Promise<string> => {
  return dataUrl; 
};

const handleSavePdf = () => {
  if (analysisRef.current) {
    html2canvas(analysisRef.current).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;
      const width = pdfWidth;
      const height = width / ratio;

      let finalHeight = height;
      if (height > pdfHeight) {
        finalHeight = pdfHeight;
      }
      
      pdf.addImage(imgData, 'PNG', 0, 0, width, finalHeight);
      pdf.save('Medical-Audit-Results.pdf');
    });
  }
};

const handleBillFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageData(reader.result as string);
      setBillText(''); 
    };
    reader.readAsDataURL(file);
  }
};

const handleInsuranceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file && file.type === 'application/pdf') {
    setInsurancePdfFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setInsurancePdfData(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  } else {
    setInsurancePdfFile(null);
    setInsurancePdfData(null);
    setError("Please upload a PDF file for the insurance summary.");
    if (insuranceFileInputRef.current) {
      insuranceFileInputRef.current.value = '';
    }
  }
};

const clearImage = () => {
  setImageData(null);
  if (billFileInputRef.current) {
    billFileInputRef.current.value = '';
  }
}

const clearInsurancePdf = () => {
  setInsurancePdfFile(null);
  setInsurancePdfData(null);
  if (insuranceFileInputRef.current) {
    insuranceFileInputRef.current.value = '';
  }
}

const handleUnlock = async () => {
  // Check both possible names for the audit data
  const tableToSave = analysisResult?.markdown || analysisResult?.analysisTable;

  // FIX: Changed 'id' to 'currentAuditId' to match your component's state
  if (!tableToSave || !currentAuditId) {
    console.error("CRITICAL: No table data found or missing Audit ID!");
    return;
  }

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId: currentAuditId, // Use the correct ID variable here
        billedAmount: analysisResult.totalBilled,
        expectedAmount: analysisResult.totalExpected,
        analysisMarkdown: tableToSave 
      }),
    });

    const session = await response.json();
    if (session.url) {
      window.location.href = session.url;
    }
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
  }
};
const canAudit = (billText.trim().length > 0 || imageData !== null) && !isPending;
  
const renderAnalysis = () => {
    if (!analysisResult) return null;

    const isUnlockedReport = initialData?.status === 'paid' || isUnlocked;

    // FIXED: Full letter copy logic
    const copyLetterToClipboard = () => {
      const fullLetter = `
DATE: ${new Date().toLocaleDateString()}
RE: Formal Dispute of Medical Billing Charges
PATIENT: ${analysisResult.patientName}

To the Billing Department Administrator,

I am writing to formally contest the charges recently billed for the services provided. Following an independent clinical audit of the billing codes used, a significant discrepancy of $${(analysisResult.totalBilled - analysisResult.totalExpected).toFixed(2)} has been identified.

AUDITOR FINDINGS:
"${analysisResult.reasoning}"

Based on fair market pricing and proper billing practices, the expected amount for these services should be $${analysisResult.totalExpected?.toFixed(2)} rather than the $${analysisResult.totalBilled?.toFixed(2)} currently requested.

Please review the line items in the associated Medical Advocacy Report and provide an adjusted invoice reflecting these corrections.

Sincerely,
${analysisResult.patientName}
      `.trim();

      navigator.clipboard.writeText(fullLetter);
      toast({ 
        title: "Copied!", 
        description: "The full appeal letter is now on your clipboard." 
      });
    };

    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        {/* 1. HEADER & ACTION BUTTONS */}
        <div className="flex justify-between items-start border-b pb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {viewMode === 'report' ? "Medical Advocacy Report" : "Custom Appeal Letter"}
            </h2>
            <p className="text-blue-600 font-bold text-lg">
              Patient: {analysisResult.patientName}
            </p>
          </div>
          {isUnlockedReport && (
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setViewMode(viewMode === 'report' ? 'letter' : 'report')}
                className={`flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    viewMode === 'letter' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-blue-50 text-blue-600'
                }`}
              >
                <FileText className="h-4 w-4" /> 
                {viewMode === 'report' ? "Generate Appeal Letter" : "Back to Report"}
              </Button>

              <Button 
                onClick={handleSavePdf} 
                variant="outline" 
                className="flex items-center gap-2 hover:bg-slate-900 hover:text-white border-slate-200 transition-all cursor-pointer shadow-sm active:scale-95 px-6"
              >
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
          )}
        </div>

        {!isUnlockedReport ? (
          /* LOCKED VIEW (REMAINS THE SAME) */
          <div className="relative space-y-6">
            <Alert variant="destructive" className={`bg-red-50 border-red-200 p-8 rounded-2xl ${showPaywall ? "blur-md pointer-events-none opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-red-100 p-3 rounded-full"><AlertCircle className="h-8 w-8 text-red-600" /></div>
                  <div>
                    <div className="text-red-700 font-semibold text-xl mb-3">
                      <span>Billed: ${analysisResult.totalBilled?.toFixed(2)}</span>
                      <span className="text-green-700 font-bold ml-6">Fair Price: ${analysisResult.totalExpected?.toFixed(2)}</span>
                    </div>
                    <p className="text-red-800/80 italic text-sm line-clamp-2 max-w-xl">
                      <strong>Preliminary Findings:</strong> {analysisResult.reasoning}
                    </p>
                  </div>
                </div>
                {!showPaywall && (
                  <Button onClick={() => handleVFDClick()} className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-7 h-auto text-lg shadow-xl cursor-pointer">
                    Verify with Front Desk
                  </Button>
                )}
              </div>
            </Alert>
{showPaywall && (
  <div className="absolute inset-0 z-10 flex items-center justify-center animate-in zoom-in-95 duration-300">
    <Button 
      onClick={handleUMSUnlock} 
      disabled={isSubscribing}
      className={`${
        isSubscribing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
      } text-white font-black px-12 py-8 h-auto text-xl shadow-2xl transition-all`}
    >
      {isSubscribing ? (
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          Connecting...
        </div>
      ) : (
        'Start Subscription ($3.99/mo)'
      )}
    </Button>
  </div>
)}
          </div>
        ) : (
          /* UNLOCKED VIEW */
          <div ref={analysisRef} className="animate-in fade-in duration-500">
            {viewMode === 'report' ? (
              <div className="space-y-10">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                  <h3 className="text-blue-900 font-bold text-xl mb-3 flex items-center gap-2"><Lightbulb className="h-5 w-5" /> Auditor Analysis</h3>
                  <p className="text-blue-800 leading-relaxed">{analysisResult.reasoning}</p>
                </div>
                <div className="prose prose-slate max-w-none prose-table:border prose-th:bg-slate-50 prose-th:p-4 prose-td:p-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult.markdown}</ReactMarkdown>
                </div>
              </div>
            ) : (
              /* THE APPEAL LETTER */
              <div className="space-y-4">
                <div className="flex justify-end">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyLetterToClipboard} 
                    className="text-blue-600 hover:bg-blue-50 flex gap-2 items-center font-bold px-4 py-2 rounded-full transition-all border border-blue-100"
                   >
                      <PlusCircle className="h-4 w-4" /> Copy
                   </Button>
                </div>
                <div className="bg-white border p-12 shadow-sm rounded-sm font-serif text-slate-800 max-w-4xl mx-auto leading-relaxed border-t-8 border-t-blue-600">
                  <p className="mb-8 text-right text-sm text-slate-400 font-sans">Formal Dispute Document</p>
                  <p className="mb-4 font-bold uppercase tracking-tight text-lg underline decoration-blue-200 decoration-4 underline-offset-8">RE: Formal Dispute of Medical Billing Charges</p>
                  <p className="mb-8">Date: {new Date().toLocaleDateString()}</p>
                  <p className="mb-4">To the Billing Department Administrator,</p>
                  <p className="mb-4">
                    I am writing to formally contest the charges recently billed for services provided. Following an independent clinical audit, a discrepancy of 
                    <strong className="text-red-600"> ${(analysisResult.totalBilled - analysisResult.totalExpected).toFixed(2)}</strong> has been identified.
                  </p>
                  <div className="bg-slate-50 p-6 my-6 border-l-4 border-blue-500 italic text-slate-700">
                    "{analysisResult.reasoning}"
                  </div>
                  <p className="mb-4">
                    Based on market pricing, the expected amount should be ${analysisResult.totalExpected?.toFixed(2)} rather than the ${analysisResult.totalBilled?.toFixed(2)} requested. Please provide an adjusted invoice reflecting these corrections.
                  </p>
                  <p className="mt-12">Sincerely,</p>
                  <div className="mt-12 pt-4 border-t w-64 border-slate-300 italic text-slate-400">
                    (Signature of Patient)
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM SUMMARY CARD */}
            <div className="mt-10 pt-8 border-t">
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex justify-between items-center">
                <div className="flex gap-10">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Total Billed</span>
                    <span className="text-2xl font-black text-red-600">${analysisResult.totalBilled?.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col border-l pl-10">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Fair Price Target</span>
                    <span className="text-2xl font-black text-green-700">${analysisResult.totalExpected?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Potential Savings</div>
                   <div className="text-3xl font-black text-green-600 animate-pulse">
                    ${(analysisResult.totalBilled - analysisResult.totalExpected).toFixed(2)}
                   </div>
                   <div className="flex items-center justify-end gap-1 mt-1 text-slate-400 text-[10px] uppercase font-bold">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Verified Audit
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

return (    
    <div className="grid gap-6">
      {/* 1. THE PROGRESS BAR - Added at the top as requested */}
      {loadingProgress > 0 && (
        <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-blue-100">
          <div 
            className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-500 ease-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )}

      {/* 2. YOUR ORIGINAL UPLOAD CARD - Fully Restored */}
      {!showPaywall && !analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Analyze Your Bill</CardTitle>
            <CardDescription>
              Paste the text from your hospital bill, or upload a photo of it. Our AI will perform a general audit for potential errors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAudit} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-slate-900">Medical Bill</h3>
                  {imageData ? (
                    <div className="relative">
                      <img src={imageData} alt="Medical bill preview" className="rounded-md max-h-60 w-auto" />
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 bg-background/50 hover:bg-background/80" onClick={clearImage}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear Image</span>
                      </Button>
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Paste your bill text here..."
                      className="min-h-[200px] resize-y"
                      value={billText}
                      onChange={(e) => setBillText(e.target.value)}
                      disabled={isPending}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={billFileInputRef}
                    onChange={handleBillFileChange}
                    className="hidden"
                    disabled={isPending}
                  />
                  {/* YOUR BUTTON: "Camera / Upload" restored exactly */}
                  <Button type="button" variant="outline" className="mt-2 hover:bg-slate-900 hover:text-white" onClick={() => billFileInputRef.current?.click()} disabled={isPending}>
                    <Camera className="mr-2 h-4 w-4" />
                    Camera / Upload
                  </Button>
                </div>
               
                {showInsuranceUpload && (
                  <div className="space-y-2 pt-4 border-t">
                    <h3 className="font-semibold text-slate-900">Insurance Summary (Optional)</h3>
                    {insurancePdfFile ? (
                      <div className="relative flex items-center gap-2 rounded-md border p-4">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{insurancePdfFile.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={clearInsurancePdf}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Clear PDF</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full">
                        <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FileText className="w-8 h-8 mb-4 text-muted-foreground" />
                            <p className="mb-2 text-sm text-center text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PDF (MAX. 5MB)</p>
                          </div>
                          <input id="pdf-upload" ref={insuranceFileInputRef} type="file" accept="application/pdf" onChange={handleInsuranceFileChange} className="hidden" />
                        </label>
                      </div> 
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t">
                {!showInsuranceUpload && (
                  <Button type="button" variant="link" className="text-muted-foreground p-0 h-auto justify-start" onClick={() => setShowInsuranceUpload(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Verify with Insurance Plan
                  </Button>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button type="submit" size="lg" disabled={!canAudit} className="bg-blue-600 text-white hover:bg-blue-700">
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Auditing...
                      </>
                    ) : (
                      'Audit My Bill'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 3. YOUR ORIGINAL LOADING STATE */}
      {isPending && (
        <Card>
          <CardHeader><CardTitle>Analyzing...</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. ERROR DISPLAY */}
      {error && (
        <Alert variant="destructive" className="animate-in fade-in-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 5. ANALYSIS RESULTS */}
      {analysisResult?.markdown && (
        <Card className="animate-in fade-in-50 duration-500 border-none shadow-none bg-transparent">
          <CardContent ref={analysisRef} className="p-0">
            {renderAnalysis()}
          </CardContent>
        </Card>
      )}

      {/* 6. RECEPTIONIST VIEW MODAL */}
      {showReceptionistView && (
        <ReceptionistViewModal
          isOpen={showReceptionistView}
          onClose={() => setShowReceptionistView(false)}
          auditId={currentAuditId ?? undefined} 
          details={analysisResult?.discrepancyDetails || {}}
          analysisTable={analysisResult?.markdown || ''}
          onLoginAttempt={() => {}}
        />
      )}
    </div>
  );
}