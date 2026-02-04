'use server';

/**
 * @fileOverview Analyzes a hospital bill to identify potential savings and billing errors.
 *
 * - analyzeBillForSavings - Analyzes the given bill text and returns potential savings and errors.
 * - AnalyzeBillForSavingsInput - The input type for the analyzeBillForSavings function.
 * - AnalyzeBillForSavingsOutput - The return type for the analyzeBillForSavings function.
 */

import {ai} from '../../ai/genkit';
import {z} from 'genkit';

const AnalyzeBillForSavingsInputSchema = z.object({
  billText: z
    .string()
    .describe('The text content extracted from the hospital bill.'),
});
export type AnalyzeBillForSavingsInput = z.infer<
  typeof AnalyzeBillForSavingsInputSchema
>;

const AnalyzeBillForSavingsOutputSchema = z.object({
  potentialSavings: z
    .string()
    .describe(
      'A summary of potential savings and identified billing errors, presented in bullet points.'
    ),
});
export type AnalyzeBillForSavingsOutput = z.infer<
  typeof AnalyzeBillForSavingsOutputSchema
>;

export async function analyzeBillForSavings(
  input: AnalyzeBillForSavingsInput
): Promise<AnalyzeBillForSavingsOutput> {
  return analyzeBillForSavingsFlow(input);
}

const analyzeBillForSavingsPrompt = ai.definePrompt({
  name: 'analyzeBillForSavingsPrompt',
  input: {schema: AnalyzeBillForSavingsInputSchema},
  output: {schema: AnalyzeBillForSavingsOutputSchema},
  prompt: `You are a medical billing audit expert. Analyze the following hospital bill text to identify potential savings, billing errors, and overcharges. Present your findings as bullet points in a markdown format. Focus on clear and concise explanations of each identified issue.

Bill Text:
{{{billText}}}`,
});

const analyzeBillForSavingsFlow = ai.defineFlow(
  {
    name: 'analyzeBillForSavingsFlow',
    inputSchema: AnalyzeBillForSavingsInputSchema,
    outputSchema: AnalyzeBillForSavingsOutputSchema,
  },
  async input => {
    const {output} = await analyzeBillForSavingsPrompt(input);
    return output!;
  }
);
