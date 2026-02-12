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
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const metadata = session.metadata;

    const auditId = metadata?.auditId;
    const userId = metadata?.userId;

    if (auditId) {
      const { error } = await supabase
        .from('audits')
        .update({ 
          status: 'paid', 
          is_unlocked: true,
          billed_amount: metadata?.totalAmount,      
          expected_amount: metadata?.suggestedAmount, 
          analysis_table: metadata?.analysisData,    
          user_id: userId,
          // FIX: Use the AI-extracted patient name and reasoning from metadata
          patient_name: metadata?.patientName || session.customer_details?.name || '',
          reasoning: metadata?.reasoning || 'Medical billing discrepancy detected.'
        })
        .eq('id', auditId);

      if (error) console.error("Database update failed:", error);
    }
  }

  return new NextResponse("Success", { status: 200 });
}