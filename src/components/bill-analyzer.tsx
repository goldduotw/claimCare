"use client";

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

// Simple markdown table parser
function parseMarkdownTable(markdown: string): { headers: string[], rows: string[][] } {
  if (!markdown || !markdown.trim()) {
    return { headers: [], rows: [] };
  }
  
  const lines = markdown.trim().split('\n');
  const discrepancyLine = lines[0].startsWith('###') ? lines.shift() : null;

  if (lines.length < 2) {
     // Not a table, maybe just a single line of text.
     const content = discrepancyLine ? `${discrepancyLine}\n\n${markdown}` : markdown;
     return { headers: [], rows: [[content]] };
  }

  const headerLineIndex = lines.findIndex(line => line.includes('|'));
  if (headerLineIndex === -1) {
    const content = discrepancyLine ? `${discrepancyLine}\n\n${markdown}` : markdown;
    return { headers: [], rows: [[content]] };
  }

  const headers = lines[headerLineIndex].split('|').map(h => h.trim()).filter(Boolean);
  const rows = lines.slice(headerLineIndex + 2).map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));
  
  if (discrepancyLine) {
    rows.unshift([`**${discrepancyLine.replace(/###/g, '').trim()}**`]);
  }
  
  if (headers.length === 0) {
      const content = discrepancyLine ? `${discrepancyLine}\n\n${markdown}` : markdown;
      return { headers: [], rows: [[content]] };
  }

  return { headers, rows };
}

const sampleDiscrepancyForTesting: DiscrepancyDetails = {
    patientName: 'Test Patient',
    expectedAmount: '$20.00',
    billedAmount: '$100.00',
    planReference: 'Page 4, Co-payment section'
};


export function BillAnalyzer() {
  const [billText, setBillText] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [insurancePdfData, setInsurancePdfData] = useState<string | null>(null);
  const [insurancePdfFile, setInsurancePdfFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{markdown: string, discrepancy: DiscrepancyDetails | null, logicTrace?: string[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showInsuranceUpload, setShowInsuranceUpload] = useState(false);
  const [showReceptionistView, setShowReceptionistView] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);
  const billFileInputRef = useRef<HTMLInputElement>(null);
  const insuranceFileInputRef = useRef<HTMLInputElement>(null);
  const user = { uid: 'dev-user' };
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();


// Final combined Effect to handle Post-Payment and Post-Login restoration
useEffect(() => {
    const auditId = searchParams.get('auditId');
    
    if (auditId) {
      const fetchAudit = async () => {
        const { data, error } = await supabase
          .from('audits')
          .select('*')
          .eq('id', auditId)
          .single();

        if (data && !error) {
          setAnalysisResult({
            markdown: data.analysis_table, // Matches your DB exactly
            discrepancy: data.status,       // Placeholder until you add details column
          });
          setShowReceptionistView(true);
        }
      };
      fetchAudit();
    }
  }, [searchParams]);

const uploadBill = async (dataUrl: string): Promise<string> => {
  return dataUrl; 
};

  const handleAudit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAnalysisResult(null);

    startTransition(async () => {
      let analysisInput = { billText, imageData: null as string | null, insurancePdfData };

      try {
          if (imageData) {
              const storageUrl = await uploadBill(imageData);
              analysisInput.imageData = storageUrl;
              analysisInput.billText = ''; // Prioritize image over text
          }

          const result = await analyzeBill(analysisInput);

          if (result.success) {
            setAnalysisResult({
              markdown: result.data.analysisMarkdown,
              discrepancy: result.data.discrepancyDetails || null,
              logicTrace: (result.data as any).logicTrace || []
            });
          } else {
            setError((result as any).error || "An error occurred");
          }
      } catch (e: any) {
          console.error("Audit failed:", e);
          setError(e.message || "An unexpected error occurred during the audit.");
      }
    });
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
        setBillText(''); // Clear text area if image is uploaded
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
  
  const openTestModal = () => {
    setShowReceptionistView(true);
  }

  const canAudit = (billText.trim().length > 0 || imageData !== null) && !isPending;
  
const renderAnalysis = (analysisResult: any) => {
  if (!analysisResult?.markdown) return null;

  // 1. Extract potential issues from the AI data
  const logicIssues = analysisResult.logicTrace || [];
  const allLines = analysisResult.markdown.split('\n');
  const tableLines = allLines.filter((line: string) => line.includes('|') && !line.includes('---'));
  
  // 2. Combine issues to trigger the Red Alert
  const actualIssues = [...logicIssues, ...tableLines].filter((issue: string) => {
    const lower = issue.toLowerCase();
    return lower.includes('flag') || (lower.includes('|') && !lower.includes('$0.00'));
  });

  return (
    <div className="mt-8 space-y-6">
      {/* 3. The Point-of-Sale Alert and Verify Button */}
      {actualIssues.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 shadow-sm flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <AlertTitle className="font-bold text-lg">Point-of-Sale Discrepancy Found</AlertTitle>
              <AlertDescription className="text-red-700">
                Our AI detected potential unbundling or overcharges.
              </AlertDescription>
            </div>
          </div>
          
          <Button 
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-full transition-all"
            onClick={() => setShowReceptionistView(true)}
          >
            Verify with Front Desk
          </Button>
        </Alert>
      )}

      {/* 4. The full AI Table results */}
      <div className="prose max-w-none dark:prose-invert">
        <ReactMarkdown>{analysisResult.markdown}</ReactMarkdown>
      </div>
    </div>
  );
};

  return (    
    <div className="grid gap-6">
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
                <h3 className="font-semibold mb-2">Medical Bill</h3>
                {imageData ? (
                <div className="relative">
                  <img src={imageData} alt="Medical bill preview" className="rounded-md max-h-60 w-auto" />
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-background/50 hover:bg-background/80" onClick={clearImage}>
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
              <Button type="button" variant="outline" className="mt-2" onClick={() => billFileInputRef.current?.click()} disabled={isPending}>
                <Camera className="mr-2 h-4 w-4" />
                Camera / Upload
              </Button>
             </div>
             
              {showInsuranceUpload && (
                 <div className="space-y-2 pt-4 border-t">
                   <h3 className="font-semibold">Insurance Summary (Optional)</h3>
                    {insurancePdfFile ? (
                      <div className="relative flex items-center gap-2 rounded-md border p-4">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{insurancePdfFile.name}</span>
                          <Button variant="ghost" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={clearInsurancePdf}>
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
                <Button type="submit" size="lg" disabled={!canAudit} className="opacity-100 pointer-events-auto bg-blue-600 text-white hover:bg-blue-700 !visible block">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Auditing...
                    </>
                  ) : (
                    'Audit My Bill'
                  )}
                </Button>
                {analysisResult?.markdown && (
                  <>
                    <Button type="button" size="lg" variant="outline" onClick={handleSavePdf} disabled={isPending} className="opacity-100 pointer-events-auto !visible">
                      <Download className="mr-2 h-4 w-4" />
                      Save to PDF
                    </Button>
                    <Button type="button" size="lg" variant="secondary" onClick={openTestModal} disabled={isPending} className="opacity-100 pointer-events-auto !visible">
                    <Lightbulb className="mr-2 h-4 w-4" />
                      Unlock Advocacy Card ($2.99)
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This is a prototype tool for educational use. Do not upload sensitive personal data.<br />
                Images are processed in real-time and never stored on our servers. 
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {isPending && (
        <Card>
          <CardHeader>
              <CardTitle>Analyzing...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
              </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="animate-in fade-in-50 duration-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysisResult?.markdown && (
        <Card className="animate-in fade-in-50 duration-500">
          <CardHeader className="flex flex-row items-start gap-4">
             <div className="bg-primary/20 p-2 rounded-full">
                <Lightbulb className="h-6 w-6 text-primary" />
             </div>
            <div>
                <CardTitle>Potential Savings Identified</CardTitle>
                <CardDescription>Based on our analysis, we found potential issues.</CardDescription>
            </div>
          </CardHeader>
          <CardContent ref={analysisRef}>
            {renderAnalysis(analysisResult)}
          </CardContent>
        </Card>
      )}

      {showReceptionistView && (
        <ReceptionistViewModal
            isOpen={showReceptionistView}
            onClose={() => setShowReceptionistView(false)}
            details={analysisResult?.discrepancy || sampleDiscrepancyForTesting}
            analysisTable={analysisResult?.markdown || ''}
        />
      )}
    </div>
  );
}