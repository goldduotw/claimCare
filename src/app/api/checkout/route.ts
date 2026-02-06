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
    const { auditId } = await req.json();
    
    // Fix for Next.js 15: cookies() is now a Promise
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
          // The setAll method may be called from a Server Component
          // This can be ignored if you have middleware refreshing user sessions
        }
      },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID, // Add your Stripe Price ID here
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata: {
        userId: user.id,
        auditId: auditId,
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