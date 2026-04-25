ClaimCare - Medical Billing Auditor as a Consumer advocate

Purpose:
The medical bill auditor is aimed at decoding the complex medical bills that often leave patients in the dark. Powered by Google Gemini, the system identifies overcharges by upcoding, duplicate, and unbundling, etc. 

principle of prompt architecture:
Implement RAG-based architecture by ingesting CMS/NCCI datasets to eliminate LLM hallucinations in medical audit results.

use persona adoption to tailor the execution and output.

Use negative contraints to enforce data privacy, such as not including SSN in output, not saving uploaded documents or personal information.

Use input and output schemas to ensure usability of output and along with specific detailed instrcutions to ground the model's response. A logicTrace is also demanded for the same reason. In other words, the AI has to explain the billing errors found and cite the precise coding references.

Use handlebars-style template for conditioning on input format. Input should allow plain texts, pdf files, and images.

current prompt:

----------------------------------------
```
You are a professional medical billing auditor expert.

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
```
----------------------------------------

the prompt will be modified for testing and evaluating model performance.

Technical Stack:
Language: Typescript
Framework: node.js
Google OAuth 2.0 is used to authenticate users. Upstash Redis is used for caching and state management, and to reduce redundant calls to LLM, and save money. 
Use supabase/PostgreSQL for database to manage paid users' information. 
USE Stripe API to manage subscriptions. 
Deploy the application on Vercel cloud Platform.



