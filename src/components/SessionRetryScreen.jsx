import { useState } from "react";

export default function SessionRetryScreen({ message, onRetry }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
          ⟳
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          Session check failed
        </h1>
        <p className="text-slate-600 text-sm">
          We could not verify your session right now. You are still signed
          in — this is usually a temporary network or rate-limit issue.
        </p>
        {message && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2 break-words">
            {message}
          </p>
        )}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {retrying ? "Retrying..." : "Retry"}
        </button>
        <p className="text-xs text-slate-400">
          Retrying keeps your session. Use Logout if you really want to sign
          out.
        </p>
      </div>
    </div>
  );
}