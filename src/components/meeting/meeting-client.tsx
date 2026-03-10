"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentResponse, CaseStatus, ConsensusReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MeetingClient({
  caseId,
  patientId,
  status,
  consensus,
  agentResponses,
  confirmedBy,
  confirmedAt,
}: {
  caseId: string;
  patientId: string;
  status: CaseStatus;
  consensus: ConsensusReport | null;
  agentResponses: AgentResponse[] | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | string | null;
}) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState(agentResponses?.[0]?.agent ?? null);
  const [names, setNames] = useState("");
  const [plan, setPlan] = useState(consensus?.consensus_recommendation ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedResponse = useMemo(
    () => agentResponses?.find((response) => response.agent === selectedAgent) ?? null,
    [agentResponses, selectedAgent],
  );

  async function handleConfirm() {
    if (!consensus) return;
    const doctorNames = names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (!doctorNames.length || !plan.trim()) {
      setError("Please add at least one attending doctor name and a final plan summary.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/cases/${caseId}/confirm`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedBy: doctorNames, finalPlan: plan.trim() }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Unable to confirm case. Please retry.");
      return;
    }

    setMessage("Case confirmed and locked.");
    router.refresh();
  }

  const disabled = status === "confirmed";

  return (
    <div className="space-y-6 text-white">
      {!consensus ? (
        <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
          Consensus report is not ready yet. Return to the case page to run the debate.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-3xl bg-white/10 p-6">
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-200">Consensus</p>
            <h2 className="text-3xl font-semibold">{consensus.consensus_recommendation}</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge className="border-emerald-200/40 bg-emerald-500/10 text-emerald-100">
                Confidence {consensus.confidence_score}/100
              </Badge>
              <Badge className="border-white/30 bg-white/10 text-white">
                Evidence {consensus.evidence_strength}
              </Badge>
              <Badge className="border-white/20 bg-white/5 text-white">{consensus.time_sensitivity}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Safety alerts</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {(consensus.safety_alerts.length ? consensus.safety_alerts : ["None flagged"]).map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Next steps</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {consensus.suggested_next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">MDT Confirmation</p>
                <p className="text-lg font-semibold">Lock treatment decision</p>
              </div>
              <p className="text-sm text-white/70">Case ID: {patientId}</p>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="text-white/70">Attending doctors (comma separated)</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-white placeholder:text-white/40"
                  rows={2}
                  value={names}
                  onChange={(event) => setNames(event.target.value)}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-white/70">Final MDT plan</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-white placeholder:text-white/40"
                  rows={5}
                  value={plan}
                  onChange={(event) => setPlan(event.target.value)}
                  disabled={disabled}
                />
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
              <Button
                onClick={handleConfirm}
                disabled={disabled || !consensus || submitting}
                className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
              >
                {disabled ? "Case Locked" : submitting ? "Confirming…" : "Confirm plan"}
              </Button>
              {disabled ? (
                <p className="text-xs text-white/60">
                  Locked by: {confirmedBy ?? "—"} · {formatTimestamp(confirmedAt?.toString())}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {agentResponses?.length ? (
        <div className="rounded-3xl bg-white/5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            {agentResponses.map((response) => (
              <button
                key={response.agent}
                onClick={() => setSelectedAgent(response.agent)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  selectedAgent === response.agent ? "bg-white text-slate-900" : "bg-white/10 text-white"
                }`}
              >
                {response.agent}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
            {selectedResponse ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between">
                  <p className="text-lg font-semibold">{selectedResponse.agent}</p>
                  <Badge className="border-white/30 bg-white/10 text-white">
                    Confidence {selectedResponse.confidence_score}/100
                  </Badge>
                </div>
                <p className="text-sm text-white/80">{selectedResponse.recommendation}</p>
                {selectedResponse.key_evidence.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">Evidence</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                      {selectedResponse.key_evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selectedResponse.treatment_conflicts_flagged.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">Conflicts</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                      {selectedResponse.treatment_conflicts_flagged.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/70">Select an agent to review their stance.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
