'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const auditId = searchParams.get('auditId');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-4 text-green-500">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your medical claim audit is now ready.
        </p>

        {auditId && (
          <div className="space-y-4">
            <Link 
              href={`/audit/${auditId}`}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              Show Receptionist Results
            </Link>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Link href="/" className="text-sm text-blue-500 hover:text-blue-600">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    // Suspense is required when using useSearchParams in Next.js
    <Suspense fallback={<div className="p-10 text-center">Loading your results...</div>}>
      <SuccessContent />
    </Suspense>
  );
}