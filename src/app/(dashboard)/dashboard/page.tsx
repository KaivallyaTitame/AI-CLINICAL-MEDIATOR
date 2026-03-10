import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { formatDate } from "@/lib/utils";
import type { CaseStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  type Case = Awaited<ReturnType<typeof prisma.patientCase.findMany>>[number];
  const cases = await prisma.patientCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const pending = cases.filter((item: Case) => item.status === "pending").length;
  const ready = cases.filter((item: Case) => item.status === "consensus_ready").length;
  const confirmed = cases.filter((item: Case) => item.status === "confirmed").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">MDT Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Patient cases</h1>
        <p className="text-sm text-slate-500">Monitor debate progress, consensus readiness, and MDT confirmations.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Awaiting analysis", value: pending },
          { label: "Consensus ready", value: ready },
          { label: "MDT confirmed", value: confirmed },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/60 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cases</h2>
            <p className="text-sm text-slate-500">Latest 25 entries</p>
          </div>
          <Link href="/cases/new" className="text-sm font-semibold text-[#1a3557]">
            + Add case
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {cases.map((item: Case) => (
            <Link
              key={item.id}
              href={`/cases/${item.id}`}
              className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-slate-50"
            >
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold text-slate-900">{item.patientId}</p>
                <p className="text-xs text-slate-500">{item.caseType}</p>
              </div>
              <div className="flex-1 text-sm text-slate-700">{item.diagnosis}</div>
              <CaseStatusBadge status={item.status as CaseStatus} />
              <div className="text-sm text-slate-500">{formatDate(item.createdAt)}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
