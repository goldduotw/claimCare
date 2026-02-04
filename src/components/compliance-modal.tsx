"use client";

export default function ComplianceModal({ onAgree }: { onAgree: () => void }) {
  return (
    /* THE MAGIC: 'fixed inset-0 flex items-center justify-center' forces centering */
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 text-center border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Compliance Guardrail</h2>
        <p className="text-slate-600 mb-8">
          This is a Prototype for educational use only. I agree not to upload Social Security Numbers or Full Names.
        </p>
        {/* THE BLUE BUTTON */}
        <button
          onClick={onAgree}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all"
        >
          I Agree & Continue
        </button>
      </div>
    </div>
  );
}