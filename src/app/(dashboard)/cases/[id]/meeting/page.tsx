import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AgentResponse, CaseStatus, ConsensusReport } from "@/lib/types";
import { MeetingLayout } from "@/components/meeting/meeting-layout";
import { MeetingClient } from "@/components/meeting/meeting-client";
import { CaseStatusBadge } from "@/components/case-status-badge";

async function getCase(id: string) {
  const patientCase = await prisma.patientCase.findUnique({ where: { id } });
  if (!patientCase) {
    notFound();
  }
  return patientCase;
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patientCase = await getCase(id);

  const agentResponses = (patientCase.agentResponses as AgentResponse[] | null) ?? null;
  const consensus = (patientCase.consensusReport as ConsensusReport | null) ?? null;

  return (
    <MeetingLayout
      header={
        <div className="flex flex-col gap-4 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Meeting mode</p>
            <h1 className="text-3xl font-semibold">Patient {patientCase.patientId}</h1>
            <p className="text-sm text-white/70">{patientCase.caseType} · {patientCase.meetingType}</p>
          </div>
          <CaseStatusBadge status={patientCase.status as CaseStatus} className="bg-white/10 text-white" />
        </div>
      }
    >
      <MeetingClient
        caseId={patientCase.id}
        patientId={patientCase.patientId}
        status={patientCase.status as CaseStatus}
        consensus={consensus}
        agentResponses={agentResponses}
        confirmedBy={patientCase.confirmedBy}
        confirmedAt={patientCase.confirmedAt}
      />
    </MeetingLayout>
  );
}
