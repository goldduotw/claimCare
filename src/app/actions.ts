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
    const [min, day] = await Promise.all([minuteLimit.limit(ip), dailyLimit.limit(ip)]);
    return min.success && day.success;
  } catch { return true; }
}

export async function analyzeBill(input: any) {
  try {
    const result = await analyzeMedicalBillForErrors(input);
console.log("AI DEBUG - DOES IT HAVE A NAME?", result.patientName);    
    const cleanAmount = (amt: string) => {
      if (!amt) return 0;
      return parseFloat(amt.replace(/[$,]/g, "")) || 0;
    };

    const billed = cleanAmount(result.totalBilledAmount);
    const expected = cleanAmount(result.totalExpectedAmount);

    return { 
      success: true, 
      data: result, 
      hasOvercharge: billed > expected,
      totalBilled: billed, 
      totalExpected: expected,
      /* CHANGE HERE: 
         We must reach into 'discrepancyDetails' to get the patientName.
         Without this '.discrepancyDetails' part, it returns nothing.
      */
     // patientName: result.discrepancyDetails?.patientName || "Valued Patient", 
      patientName: result.patientName || "",
      reasoning: result.logicTrace?.join(' ') || "Potential billing error detected"
    };
  } catch (e: any) {
    return { success: false, hasOvercharge: false, error: e.message };
  }
}