"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DuplicateCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/duplicate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/cases/${data.id}`);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={loading}
      className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      title="Duplicate Case"
    >
      {loading ? "..." : "Duplicate"}
    </button>
  );
}
