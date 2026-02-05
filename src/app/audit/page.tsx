"use client";

import {BillAnalyzer} from "../../components/bill-analyzer";

export default function AuditDashboard() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* This component contains your Upload Button and Results Table */}
      <BillAnalyzer />
    </main>
  );
}