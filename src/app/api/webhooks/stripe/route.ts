import { stripe } from "../../../../lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient"; 

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    
    const auditId = session.metadata?.auditId;
    const userId = session.metadata?.userId;
    // This is the medical bill amount (e.g. 450.00) you passed from checkout
    const medicalBillAmount = session.metadata?.billedAmount || '0.00'; 
    // This is the $3.99 fee the user just paid on Stripe
    const stripeFee = session.amount_total ? (session.amount_total / 100).toFixed(2) : '3.99';

    if (auditId) {
      console.log(`Payment confirmed! Unlocking Audit: ${auditId} for User: ${userId}`);
      
      const { error } = await supabase
        .from('audits')
        .update({ 
          status: 'paid', 
          is_unlocked: true,
          expected_amount: medicalBillAmount, // Corrected: Hospital bill goes here
          billed_amount: stripeFee,           // Corrected: Stripe fee goes here
          user_id: userId,
          patient_name: session.customer_details?.name || 'Patient'
        })
        .eq('id', auditId);

      if (error) {
        console.error("Database update failed:", error);
      }
    }
  }

  return new NextResponse("Success", { status: 200 });
}