'use server';

/**
 * @fileOverview Analyzes a medical bill for potential errors and overcharges.
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
    .describe("An image of a medical bill, as a data URI."),
  insurancePdfData: z
    .string()
    .optional()
    .nullable()
    .describe("A PDF of the user's insurance SBC, as a data URI."),
});

export type AnalyzeMedicalBillForErrorsInput = z.infer<
  typeof AnalyzeMedicalBillForErrorsInputSchema
>;

const AnalyzeMedicalBillForErrorsOutputSchema = z.object({
  analysisMarkdown: z.string().describe('The markdown table...'),
  id: z.string().optional(),
  totalBilledAmount: z.string().describe("..."),
  totalExpectedAmount: z.string().describe("..."),
  // MOVE NAME TO TOP LEVEL:
  patientName: z.string().optional().describe("The patient's full name found on the bill."),
  // Keep the rest of the object if you need it
  discrepancyDetails: z.object({
      expectedAmount: z.string().optional(),
      billedAmount: z.string().optional(),
      planReference: z.string().optional(),
  }).optional(),
  logicTrace: z.array(z.string()).optional(),
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

### CRITICAL DATA INTEGRITY RULES:
1. **MANDATORY INCLUSION**: You MUST include EVERY line item from the bill in the table. 
2. **STRICT ORDER**: You MUST list items in the EXACT top-to-bottom order they appear.
3. **CONCISE ISSUES**: Keep the "Potential Issue" column under 15 words per row to prevent text cutoff.

### AUDIT INSTRUCTIONS:
- Scan for Upcoding, Unbundling, and Duplicate charges.
- Use the Insurance SBC (if provided) to cross-reference charges.
- For every error, include a 'logicTrace' entry.

### FINAL OUTPUT FORMAT:
Return a clean Markdown table with these EXACT columns:
| Line Item | Original Price | Potential Issue | Estimated Savings |

{{#if billText}}Bill Text: {{{billText}}}{{/if}}
{{#if imageData}}Bill Image: {{media url=imageData}}{{/if}}
{{#if insurancePdfData}}Insurance SBC: {{media url=insurancePdfData}}{{/if}}
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
      return { 
        analysisMarkdown: "No analysis performed.",
        totalBilledAmount: "0.00",
        totalExpectedAmount: "0.00"
      };
    }

    return output;
  }
);