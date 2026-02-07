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
    const metadata = session.metadata;
    console.log("CHECKING SUITCASE:", metadata);
    console.log("🔍 THE SUITCASE CHECK:");
    console.log("Is metadata empty?", !metadata || Object.keys(metadata).length === 0);
    console.log("Total Amount found:", metadata?.totalAmount);
    console.log("Suggested Amount found:", metadata?.suggestedAmount);

    // 1. Unpack exactly what we sent from the checkout route
    const auditId = metadata?.auditId;
    const userId = metadata?.userId;
    const totalAmount = metadata?.totalAmount;       // The $1250
    const suggestedAmount = metadata?.suggestedAmount; // The Suggested Number
    const analysisData = metadata?.analysisData;     // The Table

    if (auditId) {
      console.log(`Unlocking Audit: ${auditId} | Billed: ${totalAmount}`);

      const { error } = await supabase
        .from('audits')
        .update({ 
          status: 'paid', 
          is_unlocked: true,
          billed_amount: metadata?.totalAmount,      // Matches checkout
          expected_amount: metadata?.suggestedAmount, // Matches checkout
          analysis_table: metadata?.analysisData,    // Matches checkout
          user_id: userId,
          patient_name: session.customer_details?.name || 'Valued Patient'
        })
        .eq('id', auditId);

      if (error) console.error("Database update failed:", error);
    }
  }

  return new NextResponse("Success", { status: 200 });
}


