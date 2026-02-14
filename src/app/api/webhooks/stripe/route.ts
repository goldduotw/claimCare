import { stripe } from "../../../../lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; 
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const { auditId, userId } = session.metadata;

    // 1. Get the full data from Redis (since Stripe metadata is truncated)
    const pendingData: any = await redis.get(`audit:${auditId}`);

    if (auditId && pendingData) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS
      );

      // 2. Move data from Redis to Supabase
      const { error } = await supabaseAdmin
        .from('audits')
        .upsert({ 
          id: auditId,
          user_id: userId,
          status: 'paid', 
          is_unlocked: true,
          billed_amount: pendingData.totalBilled,      
          expected_amount: pendingData.totalExpected, 
          analysis_table: pendingData.markdown,    
          patient_name: pendingData.patientName,
          reasoning: pendingData.reasoning
        });

      if (!error) {
        // 3. Clean up Redis now that it's in the permanent DB
        await redis.del(`audit:${auditId}`);
        console.log("✅ Successfully migrated Audit to Supabase:", auditId);
      } else {
        console.error("❌ DB Migration Failed:", error.message);
      }
    }
  }

  return new NextResponse("Success", { status: 200 });
}