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
            } catch (error) { /* Safely ignore header mutation errors on Vercel */ }
          },
        },
      }
    );

    // Use getSession() as a fallback for getUser() on high-latency Vercel starts
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (!user) {
      console.error("SUPABASE AUTH ERROR: No session found in cookies.");
      return NextResponse.json({ error: "Unauthorized: Please log in again" }, { status: 401 });
    }

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      metadata: {      
        userId: user.id,
        auditId: body.auditId,
        totalAmount: String(body.billedAmount || "0.00"),      
        suggestedAmount: String(body.expectedAmount || "0.00"), 
        analysisData: String(body.analysisMarkdown || "").substring(0, 400), 
        patientName: String(body.patientName || "Valued Patient"),
        reasoning: String(body.reasoning || "Discrepancy detected").substring(0, 400)
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${body.auditId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${body.auditId}?canceled=true`,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}