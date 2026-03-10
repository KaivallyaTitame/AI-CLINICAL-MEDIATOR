import { CaseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<CaseStatus, { label: string; styles: string }> = {
  pending: { label: "Pending Analysis", styles: "bg-slate-100 text-slate-700" },
  analyzing: { label: "Debate In Progress", styles: "bg-amber-100 text-amber-800" },
  consensus_ready: { label: "Consensus Ready", styles: "bg-emerald-100 text-emerald-800" },
  confirmed: { label: "MDT Confirmed", styles: "bg-indigo-100 text-indigo-800" },
};

export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const state = STATUS_MAP[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", state.styles, className)}>
      {state.label}
    </span>
  );
}
