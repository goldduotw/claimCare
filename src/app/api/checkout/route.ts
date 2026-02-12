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
    // 1. EXTRACT ALL DATA (Not just auditId)
  //  const { auditId, totalAmount, suggestedAmount, analysisData } = await req.json();
    const { auditId, billedAmount, expectedAmount, analysisMarkdown, patientName, reasoning } = await req.json();

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
            } catch (error) {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      // 2. PACK THE SUITCASE: Add the medical bill data here
      metadata: {      
        userId: user.id,
        auditId: auditId,
        // Wrap these in String() so Stripe doesn't drop them
        totalAmount: String(billedAmount || "0.00"),      
        suggestedAmount: String(expectedAmount || "0.00"), 
        analysisData: String(analysisMarkdown || "").substring(0, 450), // Stripe limit is 500 chars
        patientName: "",
        reasoning: String(reasoning || "Discrepancy detected")
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${auditId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/audit/${auditId}?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}