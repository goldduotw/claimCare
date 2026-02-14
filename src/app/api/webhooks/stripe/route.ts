import { stripe } from "../../../../lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; 
import { Redis } from "@upstash/redis";

// Vercel requires these to be initialized outside the POST function
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  console.log("🔔 WEBHOOK: Event Received");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, 
      signature, 
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error("❌ WEBHOOK: Signature Verification Failed:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const { auditId, userId } = session.metadata;

    console.log(`🔍 WEBHOOK: Processing Audit ${auditId} for User ${userId}`);

    // 1. Fetch the full audit data from Redis
    // This is critical because Stripe metadata is often truncated
    const pendingData: any = await redis.get(`audit:${auditId}`);

    if (!pendingData) {
      console.error("❌ WEBHOOK: No data found in Redis for this ID. Did it expire?");
      return new NextResponse("Redis Data Missing", { status: 404 });
    }

    // 2. Initialize the Admin Client (Bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    console.log("💾 WEBHOOK: Attempting Supabase Upsert...");

    // 3. Perform the Database Write (MUST USE AWAIT)
    const { error: dbError } = await supabaseAdmin
      .from('audits')
      .upsert({ 
        id: auditId,
        user_id: userId,
        status: 'paid', 
        is_unlocked: true,
        billed_amount: parseFloat(pendingData.totalBilled || "0"),      
        expected_amount: parseFloat(pendingData.totalExpected || "0"), 
        analysis_table: pendingData.markdown,    
        patient_name: pendingData.patientName || "",
        reasoning: pendingData.reasoning || 'Medical billing discrepancy detected.'
      }, { onConflict: 'id' });

    if (dbError) {
      console.error("❌ WEBHOOK: Supabase Write Failed:", dbError.message);
      return new NextResponse("Database Error", { status: 500 });
    }

    // 4. Cleanup Redis
    await redis.del(`audit:${auditId}`);
    console.log("✅ WEBHOOK: Successfully saved to DB and cleaned Redis");
  }

  return new NextResponse("Success", { status: 200 });
}