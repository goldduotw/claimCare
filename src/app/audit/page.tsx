"use client";

import { Suspense } from "react";
import { BillAnalyzer } from "../../components/bill-analyzer";

export default function AuditDashboard() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Vercel requires Suspense here because BillAnalyzer 
          uses search parameters to show audit results.
      */}
      <Suspense fallback={<div className="p-8 text-center">Loading analyzer...</div>}>
        <BillAnalyzer />
      </Suspense>
    </main>
  );
}