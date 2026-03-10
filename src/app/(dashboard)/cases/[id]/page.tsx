import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, scoreTone } from "@/lib/utils";
import type { AgentResponse, CaseStatus, ConsensusReport } from "@/lib/types";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { DebateProgressPanel } from "@/components/agents/debate-progress-panel";
import { ConsensusPdfButton } from "@/components/report/consensus-pdf-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getCase(id: string) {
  const patientCase = await prisma.patientCase.findUnique({ where: { id } });
  if (!patientCase) {
    notFound();
  }
  return patientCase;
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patientCase = await getCase(id);

  const agentResponses = (patientCase.agentResponses as AgentResponse[] | null) ?? null;
  const consensus = (patientCase.consensusReport as ConsensusReport | null) ?? null;
  const safetyAlerts = consensus?.safety_alerts ?? [];
  const treatmentOptions = consensus?.treatment_options_ranked ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Case detail</p>
          <h1 className="text-3xl font-semibold text-slate-900">Patient {patientCase.patientId}</h1>
          <p className="text-sm text-slate-500">
            {patientCase.caseType} · {patientCase.meetingType} · Created {formatDate(patientCase.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CaseStatusBadge status={patientCase.status as CaseStatus} />
          {consensus ? <ConsensusPdfButton patientId={patientCase.patientId} report={consensus} /> : null}
          <Link
            href={`/cases/${patientCase.id}/meeting`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#1a3557]"
          >
            Open Meeting Mode
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-6">
          <p className="text-sm font-semibold text-slate-900">Patient profile</p>
          <div className="text-sm text-slate-600">
            <p>Age: {patientCase.age}</p>
            <p>Sex: {patientCase.sex}</p>
            {patientCase.weight ? <p>Weight: {patientCase.weight} kg</p> : null}
            <p>Comorbidities: {patientCase.comorbidities.length ? patientCase.comorbidities.join(", ") : "—"}</p>
            <p>Medications: {patientCase.medications.length ? patientCase.medications.join(", ") : "—"}</p>
          </div>
        </Card>
        <Card className="space-y-3 p-6">
          <p className="text-sm font-semibold text-slate-900">Diagnostics</p>
          <p className="text-sm text-slate-600">{patientCase.diagnosis}</p>
          {patientCase.imagingSummary ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Imaging</p>
              <p className="text-sm text-slate-600">{patientCase.imagingSummary}</p>
            </div>
          ) : null}
          {patientCase.biopsyResults ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Biopsy</p>
              <p className="text-sm text-slate-600">{patientCase.biopsyResults}</p>
            </div>
          ) : null}
        </Card>
        <Card className="space-y-3 p-6">
          <p className="text-sm font-semibold text-slate-900">Risk scores</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries((patientCase.riskScores as Record<string, string>) ?? {}).map(([key, value]) => (
              <span key={key} className="rounded-full bg-slate-100 px-3 py-1">
                {key}: {value}
              </span>
            ))}
            {!Object.keys((patientCase.riskScores as Record<string, string>) ?? {}).length ? <span>—</span> : null}
          </div>
        </Card>
      </div>

      <DebateProgressPanel
        caseId={patientCase.id}
        status={patientCase.status as CaseStatus}
        agentResponses={agentResponses}
        consensus={consensus}
      />

      {consensus ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Card className="flex-1 space-y-2 border-emerald-200 p-6">
              <p className="text-sm font-semibold text-emerald-700">Consensus recommendation</p>
              <p className="text-2xl font-semibold text-slate-900">{consensus.consensus_recommendation}</p>
              <Badge className={`${scoreTone(consensus.confidence_score)} border`}>
                Confidence {consensus.confidence_score}/100
              </Badge>
            </Card>
            <Card className="space-y-3 p-6">
              <p className="text-sm font-semibold text-slate-900">Evidence strength</p>
              <Badge
                className={
                  consensus.evidence_strength === "High"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : consensus.evidence_strength === "Moderate"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                }
              >
                {consensus.evidence_strength}
              </Badge>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Time sensitivity</p>
              <p className="text-sm text-slate-700">{consensus.time_sensitivity}</p>
            </Card>
          </div>

          {safetyAlerts.length ? (
            <Card className="border-rose-200 bg-rose-50 p-6">
              <p className="text-sm font-semibold text-rose-700">Safety alerts</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-rose-800">
                {safetyAlerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <p className="text-sm font-semibold text-slate-900">Treatment options ranked</p>
              <div className="mt-4 space-y-3">
                {treatmentOptions.map((option) => (
                  <div key={option.option} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-900">{option.option}</p>
                      <Badge className={`${scoreTone(option.score)} border`}>{option.score}/100</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{option.rationale}</p>
                    {option.citations.length ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Citations: {option.citations.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">Agent agreement</p>
                <p className="text-sm text-slate-600">{consensus.agent_agreement_summary}</p>
              </div>
              {consensus.dissenting_views.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Dissenting views</p>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                    {consensus.dissenting_views.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="text-sm font-semibold text-slate-900">Next steps</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  {consensus.suggested_next_steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      {agentResponses ? (
        <section className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Agent debate log</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {agentResponses.map((response) => (
              <Card key={response.agent} className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{response.agent}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Confidence {response.confidence_score}/100</p>
                  </div>
                  {response.error ? (
                    <Badge className="border-rose-200 bg-rose-50 text-rose-700">Error</Badge>
                  ) : (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Complete</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-700">{response.recommendation}</p>
                {response.key_evidence.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Key evidence</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {response.key_evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {response.risks_identified.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Risks</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {response.risks_identified.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {response.treatment_conflicts_flagged.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Conflicts flagged</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {response.treatment_conflicts_flagged.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
