"use server";

import { analyzeMedicalBillForErrors, AnalyzeMedicalBillForErrorsInput, AnalyzeMedicalBillForErrorsOutput } from '../ai/flows/analyze-medical-bill-for-errors';

export async function analyzeBill(input: AnalyzeMedicalBillForErrorsInput): Promise<{ 
  success: true; 
  data: AnalyzeMedicalBillForErrorsOutput;
  hasOvercharge: boolean; // Add this to help the frontend
} | { success: false; error: string }> {
  
  if (!input.billText?.trim() && !input.imageData) {
    return { success: false, error: "Please provide either bill text or an image of the bill." };
  }
  
  if (input.billText && input.billText.trim().length < 20) {
     return { success: false, error: "Please provide more detailed bill text for an accurate analysis." };
  }

  try {
    console.log("AI Input Text:", input.billText); 
    
    const result = await analyzeMedicalBillForErrors(input);
    
    console.log("AI Output Result:", JSON.stringify(result, null, 2));

    // ✅ LOGIC FIX: Determine if an overcharge exists based on logicTrace entries
    const hasOvercharge = !!(result.logicTrace && result.logicTrace.length > 0);

    return { 
      success: true, 
      data: result,
      hasOvercharge: hasOvercharge // Pass this flag to your UI
    };
  } catch (e: any) {
    console.error(e);
    const errorMessage = e.message || "An unexpected error occurred during analysis.";
    return { success: false, error: errorMessage };
  }
}