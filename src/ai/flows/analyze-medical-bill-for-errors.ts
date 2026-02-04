
'use server';

/**
 * @fileOverview Analyzes a medical bill for potential errors and overcharges.
 *
 * - analyzeMedicalBillForErrors - A function that handles the analysis process.
 * - analyzeMedicalBillForErrorsInput - The input type for the analyzeMedicalBillForErrors function.
 * - analyzeMedicalBillForErrorsOutput - The return type for the analyzeMedicalBillForErrors function.
 */

import {ai} from '../../ai/genkit';
import {z} from 'genkit';

const AnalyzeMedicalBillForErrorsInputSchema = z.object({
  billText: z
    .string()
    .optional()
    .describe('The text extracted from the medical bill to be analyzed.'),
  imageData: z
    .string()
    .optional()
    .nullable()
    .describe("An image of a medical bill, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  insurancePdfData: z
    .string()
    .optional()
    .nullable()
    .describe("A PDF of the user's insurance Summary of Benefits and Coverage (SBC), as a data URI."),
});
export type AnalyzeMedicalBillForErrorsInput = z.infer<
  typeof AnalyzeMedicalBillForErrorsInputSchema
>;

const AnalyzeMedicalBillForErrorsOutputSchema = z.object({
  analysisMarkdown: z
    .string()
    .describe(
      'A markdown table with columns for "Line Item", "Potential Issue", and "Estimated Savings".'
    ),
    discrepancyDetails: z.object({
        patientName: z.string().optional().describe("The patient's name, if found."),
        expectedAmount: z.string().optional().describe("The expected co-pay or cost."),
        billedAmount: z.string().optional().describe("The amount that was actually billed or paid at the point of sale."),
        planReference: z.string().optional().describe("The page or section in the SBC for reference."),
    }).optional().describe("Details of any point-of-sale discrepancy found."),
  logicTrace: z.array(z.string()).optional().describe("An array of strings, where each string is a detailed explanation of the reasoning for flagging a potential issue."),
});
export type AnalyzeMedicalBillForErrorsOutput = z.infer<
  typeof AnalyzeMedicalBillForErrorsOutputSchema
>;

export async function analyzeMedicalBillForErrors(
  input: AnalyzeMedicalBillForErrorsInput
): Promise<AnalyzeMedicalBillForErrorsOutput> {
  return analyzeMedicalBillForErrorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeMedicalBillForErrorsPrompt',
  input: {schema: AnalyzeMedicalBillForErrorsInputSchema},
  output: {schema: AnalyzeMedicalBillForErrorsOutputSchema},
  prompt: `You are a professional medical billing auditor expert.

Before you start the audit, scan the text for any Patient Names, Birthdays, SSNs, or Member IDs. If you find them, immediately replace them with [REDACTED] in your internal processing and never show them in the final output. Only focus on the CPT codes, descriptions, and prices.

If you see a Name, Phone Number, or SSN in the bill, DO NOT include them in the audit results. Only use the medical codes and prices.
Analyze this image of a medical bill or the provided text. Extract all line items and then perform an audit.

For every single error you find, you MUST include a 'Logic Trace' entry in the output metadata. This is a justification for your finding.
Example Logic Trace: 'Flag: Unbundling. Reason: CPT 12001 (simple repair) is an integral component of CPT 19301 (mastectomy) per NCCI Procedure-to-Procedure (PTP) edits. Reference: National Correct Coding Initiative guidelines.'

{{#if insurancePdfData}}
You are in 'Advocate Mode'. A PDF of the user's insurance Summary of Benefits and Coverage (SBC) has been provided. You MUST cross-reference the bill against the SBC's 'Patient Responsibility' section (Deductibles, Co-pays, Co-insurance, etc.).

Your primary goal is to find discrepancies where the patient was charged more than their responsibility outlined in the SBC. If you find such a discrepancy, you MUST begin your response with the line: '### Point-of-Sale Discrepancy Found!'.

In addition to the markdown table, you MUST populate the 'discrepancyDetails' object. Extract the patient's name if available (otherwise use "the patient"). Extract the specific expected cost (e.g., "$20.00 Co-pay") from the SBC, the amount the patient was actually billed from the medical bill, and the page number or section of the SBC that confirms this (e.g., "Page 4, Co-payment section").

When describing the issue in the markdown table, you MUST quote the relevant text from the SBC PDF as evidence.
Example: 'Discrepancy found. Bill charges $100. SBC (Page 4, Section "Specialist Visit") states: "Co-payment: $50.00".'

Then, provide the standard markdown table, detailing the specific line items that conflict with the SBC.
{{else}}
You are in 'Standard Audit' mode. No insurance summary was provided. Perform a 'Standard Audit' based on your knowledge of common medical billing practices.

When you audit, look for the following:
1. Upcoding (billing for a more complex service than provided)
2. Unbundling (separating services that should be one code)
3. Duplicate charges
{{/if}}

Return the results in a clean Markdown table with columns for 'Line Item', 'Potential Issue', and 'Estimated Savings'.

{{#if billText}}
Medical Bill Text:
{{{billText}}}
{{/if}}

{{#if imageData}}
Medical Bill Image:
{{media url=imageData}}
{{/if}}

{{#if insurancePdfData}}
Insurance Summary PDF:
{{media url=insurancePdfData}}
{{/if}}
`,
});

const analyzeMedicalBillForErrorsFlow = ai.defineFlow(
  {
    name: 'analyzeMedicalBillForErrorsFlow',
    inputSchema: AnalyzeMedicalBillForErrorsInputSchema,
    outputSchema: AnalyzeMedicalBillForErrorsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      config: {
        temperature: 0,
        topP: 0.1,
      }
    });
    if (!output) {
      return { analysisMarkdown: "No analysis could be performed." };
    }
    
    // A simple check to see if the output looks like a table.
    // If not, we can provide a default message.
    if (!output.analysisMarkdown.includes('|') && !output.discrepancyDetails) {
       return { analysisMarkdown: "No obvious errors or overcharges were found in the provided bill. For a more thorough review, consider consulting a professional medical bill auditor." };
    }

    return output;
  }
);
