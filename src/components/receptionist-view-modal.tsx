"use client";

import { supabase } from '../lib/supabaseClient';
import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Lock, Share, User, Loader2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Alert, AlertDescription } from "../components/ui/alert";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "../hooks/use-toast";
import Confetti from 'react-confetti';
import { STRIPE_PRICE_ID } from '../lib/stripe'

export type DiscrepancyDetails = {
    patientName?: string;
    expectedAmount?: string;
    billedAmount?: string;
    planReference?: string;
}

type ReceptionistViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  details: DiscrepancyDetails;
  analysisTable: string;
  auditId?: string; 
  onLoginAttempt?: () => void;
};

function parseMarkdownTable(markdown: string): { headers: string[], rows: string[][] } {
    if (!markdown || !markdown.trim()) return { headers: [], rows: [] };
    const lines = markdown.trim().split('\n');
    const headerLineIndex = lines.findIndex(line => line.includes('|'));
    if (headerLineIndex === -1) return { headers: [], rows: [] };
    
    const headers = lines[headerLineIndex].split('|').map(h => h.trim()).filter(Boolean);
    const rows = lines.slice(headerLineIndex + 2)
        .filter(line => line.includes('|') && !line.includes('---'))
        .map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));
    return { headers, rows };
}

export function ReceptionistViewModal({ isOpen, onClose, details, analysisTable, auditId, onLoginAttempt }: ReceptionistViewModalProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [user, setUser] = useState<any>(null);

  const { toast } = useToast();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const hasAnnouncedSuccess = useRef(false);

  // FIX: This Auth Listener solves the "You must be signed in" error
  useEffect(() => {
    // 1. Check for an existing session on load
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkUser();

    // 2. Listen for sign-in/out changes in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { headers, rows } = useMemo(() => parseMarkdownTable(analysisTable), [analysisTable]);

  useEffect(() => {
    if (!isOpen || !auditId) return;

    const syncStatus = async () => {
        setIsLoadingStatus(true);
        const { data } = await supabase.from('audits').select('status').eq('id', auditId).single();
        if (data?.status === 'paid') {
            setPaymentStatus('paid');
            if (!hasAnnouncedSuccess.current) {
                setShowConfetti(true);
                hasAnnouncedSuccess.current = true;
            }
        }
        setIsLoadingStatus(false);
    };

    syncStatus();

    const channel = supabase.channel(`status_${auditId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${auditId}` }, 
        (payload) => {
            if (payload.new.status === 'paid') {
                setPaymentStatus('paid');
                setShowConfetti(true);
            }
        }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, auditId]);

  const handleGoogleSignIn = async () => {
    // 3. Trigger the save function from the parent
    if (onLoginAttempt) onLoginAttempt();
    // 4. Update this key to match BillAnalyzer's "pending_audit_results"
    localStorage.setItem('pending_audit_results', JSON.stringify({ 
      markdown: analysisTable, 
      discrepancy: details 
    }));
 //   localStorage.setItem('pending_audit_data', JSON.stringify({ details, analysisTable, auditId }));
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin 
        }
    });
  };

  const handleCheckout = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be signed in to checkout." });
        return;
    }
    setIsCheckingOut(true);
    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auditId: auditId }), 
            credentials: 'include'
        });
        const { url } = await response.json();
        if (url) window.location.assign(url);
    } catch (e) {
        setIsCheckingOut(false);
        toast({ variant: "destructive", title: "Checkout Error" });
    }
  };

  const isUnlocked = paymentStatus === 'paid';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
<DialogContent className="w-[95vw] sm:max-w-4xl bg-white text-gray-900 h-[90vh] md:h-auto overflow-hidden flex flex-col p-0">
    <div className="flex-1 overflow-y-auto p-0">       

        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}
        <div className="relative">
{/* Main Report Content */}
            <div ref={modalContentRef} className={`p-4 md:p-8 transition-all duration-700 ${!isUnlocked ? 'blur-2xl pointer-events-none opacity-50' : 'blur-0 opacity-100'}`}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center text-blue-900 uppercase tracking-tight">Patient Advocacy Report</DialogTitle>
                    <p className="text-center text-sm text-gray-500 font-medium">Verified for {details.patientName || "the Patient"}</p>
                </DialogHeader>

                <div className="my-6 border-4 border-dashed border-green-500 rounded-xl p-4 bg-green-50 text-center w-full max-w-full overflow-hidden">
                    {/* Simplified stacking logic */}
                    <div className="flex flex-col md:flex-row justify-center items-center">
                        <div className="py-2">
                            <p className="text-[10px] uppercase text-gray-400 font-bold">Fair Price</p>
                            <p className="text-3xl md:text-4xl font-black text-green-600 leading-none">{details.expectedAmount}</p>
                        </div>
                        
                        {/* Divider: Only shows on desktop */}
                        <div className="hidden md:block border-r border-gray-200 h-12 mx-8"></div>
                        
                        {/* Mobile Divider: Only shows on phone */}
                        <div className="w-16 border-t border-gray-200 my-4 md:hidden"></div>
                        
                        <div className="py-2">
                            <p className="text-[10px] uppercase text-gray-400 font-bold">Billed Amount</p>
                            <p className="text-3xl md:text-4xl font-black text-red-500 leading-none">{details.billedAmount}</p>
                        </div>
                    </div>
                </div>

                {/* UPDATED: Added overflow-x-auto so the table doesn't squish on phones */}
                <div className="border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                {headers.map((h, i) => <TableHead key={i} className="font-bold whitespace-nowrap">{h}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, ri) => (
                                <TableRow key={ri}>
                                    {row.map((c, ci) => <TableCell key={ci} className="py-4 text-sm font-medium whitespace-nowrap">{c}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Overlay Layer */}
            {!isUnlocked && (
                 <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-white/5">
                    <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 max-w-sm mx-auto">
                        <div className="bg-blue-50 p-4 rounded-full mb-4">
                            <Lock className="h-8 w-8 text-blue-600" />
                        </div>
                        
                        {!user ? (
                            <div className="flex flex-col items-center">
                                <h3 className="text-2xl font-black mb-2 text-gray-900 text-center tracking-tight">
                                    Sign in for details
                                </h3>
                                <p className="text-gray-500 mb-6 text-xs text-center leading-relaxed">
                                    Please sign in with Google to securely link this audit to your account and proceed.
                                </p>
                                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full font-bold shadow-lg" onClick={handleGoogleSignIn}>
                                    <User className="mr-2 h-4 w-4" /> Sign In with Google
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <h3 className="text-2xl font-black mb-2 text-gray-900 text-center tracking-tight">Locked Report</h3>
                                <p className="text-gray-500 mb-6 text-xs text-center leading-relaxed">Unlock the full advocacy card for a monthly fee.<br />Cancel at anytime.<br />The accuracy of this audit is approximately 80%. 
     Use your discretion when reviewing these findings.</p>
                                <Button size="lg" className="bg-green-600 hover:bg-green-700 w-full font-extrabold py-7 text-xl shadow-xl" onClick={handleCheckout} disabled={isCheckingOut}>
                                    {isCheckingOut ? <Loader2 className="animate-spin h-5 w-5" /> : "Unlock for $3.99/mon"}
                                </Button>
                            </div>
                        )}
                    </div>
                 </div>
            )}
        </div>
</div>
        <DialogFooter className="px-8 pb-8 pt-4">
            <Button variant="outline" className="flex-1 font-bold" onClick={() => {}} disabled={!isUnlocked}>
                <Share className="mr-2 h-4 w-4" /> Export Advocacy Card
            </Button>
            <DialogClose asChild>
                <Button variant="outline" className="flex-1 font-semibold">Close</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}