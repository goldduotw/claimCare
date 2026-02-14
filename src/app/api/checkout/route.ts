import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_PRICE_ID } from '../../../lib/stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { auditId, billedAmount, expectedAmount, analysisMarkdown, patientName, reasoning } = body;

    // VERCEL FIX: Validate auditId immediately to avoid /audit/null
    if (!auditId || auditId === 'null') {
      return NextResponse.json({ error: "Missing Audit ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // Vercel sometimes throws non-critical errors here during header mutations
            }
          },
        },
      }
    );

    // Get user with improved error logging for Vercel dashboard
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("SUPABASE AUTH ERROR:", authError?.message);
      return NextResponse.json({ error: "Unauthorized: Please log in again" }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      metadata: {      
        userId: user.id,
        auditId: auditId,
        totalAmount: String(billedAmount || "0.00"),      
        suggestedAmount: String(expectedAmount || "0.00"), 
        // Truncate analysisData to be safe (Stripe limit is 500 chars total)
        analysisData: String(analysisMarkdown || "").substring(0, 400), 
        patientName: String(patientName || "Valued Patient"), // FIXED: No longer ""
        reasoning: String(reasoning || "Discrepancy detected").substring(0, 400)
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${auditId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${auditId}?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}