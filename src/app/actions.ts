"use server";

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { analyzeMedicalBillForErrors } from '../ai/flows/analyze-medical-bill-for-errors';

const redis = Redis.fromEnv();
const minuteLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "15 m"), prefix: "rl_min" });
const dailyLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, "24 h"), prefix: "rl_day" });

export async function checkRateLimit(): Promise<boolean> {
  try {
    const ip = (await headers()).get("x-forwarded-for") || "127.0.0.1";
   // await Promise.all([minuteLimit.limit(ip), dailyLimit.limit(ip)]);
    return true || (await Promise.all([minuteLimit.limit(ip), dailyLimit.limit(ip)])).every(r => r.success);

  } catch { return true; }
}

export async function analyzeBill(input: any) {
  try {
    const result = await analyzeMedicalBillForErrors(input);
    
    const cleanAmount = (amt: string) => {
      if (!amt) return 0;
      return parseFloat(amt.replace(/[$,]/g, "")) || 0;
    };

    const billed = cleanAmount(result.totalBilledAmount);
    const expected = cleanAmount(result.totalExpectedAmount);
    
    // Use the global crypto object - no import needed in Next.js 14/15
    const auditId = crypto.randomUUID();

    const reportData = {
      auditId,
      // FIXED SYNTAX: We check both possible property names
      markdown: result.analysisMarkdown || (result as any).analysisTableMarkdown || "", 
      totalBilled: billed,
      totalExpected: expected,
      patientName: result.patientName || "",
      reasoning: result.logicTrace?.join(' ') || "Potential billing error detected"
    };

    // SAVE TO REDIS: This is the data the webhook was missing
    // We use the prefix "audit:" to stay organized
    const redisKey = `audit:${auditId}`;
    await redis.set(redisKey, reportData, { ex: 86400 }); 

    console.log(`✅ REDIS SAVE SUCCESS: ${redisKey}`);

    return { 
      success: true, 
      auditId, 
      data: result, 
      hasOvercharge: billed > expected,
      totalBilled: billed, 
      totalExpected: expected,
      patientName: reportData.patientName,
      reasoning: reportData.reasoning
    };
  } catch (e: any) {
    console.error("AI_ACTION_ERROR:", e.message);
    return { success: false, hasOvercharge: false, error: e.message };
  }
}