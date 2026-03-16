"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentResponse, CaseStatus, ConsensusReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type EventItem =
  | { type: "agent_started"; agent: string; timestamp: string; position?: number; total?: number }
  | { type: "agent_completed"; agent: string; result: AgentResponse; timestamp: string; position?: number; total?: number }
  | { type: "agent_failed"; agent: string; error: string; timestamp: string; position?: number; total?: number }
  | { type: "moderator_started"; timestamp: string }
  | { type: "moderator_completed"; consensus: ConsensusReport; timestamp: string }
  | { type: "start"; agents: string[]; timestamp: string }
  | { type: "error"; error: string; timestamp: string }
  | { type: "complete"; timestamp: string; consensus: ConsensusReport };

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

export function DebateProgressPanel({
  caseId,
  status,
  agentResponses,
  consensus,
}: {
  caseId: string;
  status: CaseStatus;
  agentResponses: AgentResponse[] | null;
  consensus: ConsensusReport | null;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");

  const formatAgentProgress = useCallback((agent: string, position?: number, total?: number) => {
    if (!position || !total) {
      return `Running ${agent}… please wait`;
    }
    return `Running ${agent} (${position}/${total})… please wait`;
  }, []);

  const canAnalyze = status === "pending";

  const handleAnalyze = useCallback(async () => {
    setRunning(true);
    setEvents([]);
    setError(null);
    setProgressMessage("Initializing multidisciplinary agents…");

    try {
      const response = await fetch(`/api/cases/${caseId}/analyze`, { method: "POST" });
      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = payload?.error || JSON.stringify(payload);
        } catch {
          detail = await response.text();
        }
        throw new Error(detail || "Unable to start debate for this case.");
      }
      if (!response.body) {
        throw new Error("No response body returned");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.replace(/^data:\s*/, "");
          try {
            const event = JSON.parse(json) as EventItem;
            setEvents((prev) => [...prev, event]);
            if (event.type === "agent_started") {
              setProgressMessage(formatAgentProgress(event.agent, event.position, event.total));
            }
            if (event.type === "agent_completed") {
              setProgressMessage(
                event.position && event.total
                  ? `${event.agent} completed (${event.position}/${event.total}). Preparing next agent…`
                  : `${event.agent} completed. Preparing next agent…`,
              );
            }
            if (event.type === "agent_failed") {
              setProgressMessage(`Agent ${event.agent} failed: ${event.error}`);
            }
            if (event.type === "moderator_started") {
              setProgressMessage("Synthesizing consensus… almost done");
            }
            if (event.type === "error") {
              setError(event.error || "Moderator error");
              setProgressMessage("Analysis interrupted due to an error.");
            }
            if (event.type === "complete") {
              setProgressMessage("Consensus ready! Refreshing latest data…");
              router.refresh();
            }
          } catch (parseError) {
            console.error("Unable to parse event", parseError);
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setProgressMessage("Analysis interrupted due to an error.");
    } finally {
      setRunning(false);
    }
  }, [caseId, router, formatAgentProgress]);

  const latestAgents = useMemo(() => {
    const map = new Map<string, { status: string; timestamp: string }>();
    events.forEach((event) => {
      if (event.type === "agent_started") {
        map.set(event.agent, { status: "Analyzing", timestamp: event.timestamp });
      }
      if (event.type === "agent_completed") {
        map.set(event.agent, { status: "Complete", timestamp: event.timestamp });
      }
    });
    return map;
  }, [events]);

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a3557]">AI Debate Orchestration</p>
          <p className="text-sm text-slate-500">Run parallel agent analysis and stream progress in real-time.</p>
        </div>
        <Button onClick={handleAnalyze} disabled={!canAnalyze || running}>
          {running
            ? "Analysis in progress… this may take 3-5 minutes due to free tier rate limits. Please do not close this page."
            : "Start Debate"}
        </Button>
      </div>

      {progressMessage ? <p className="text-sm text-slate-600">{progressMessage}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{event.type.replace("_", " ")}</span>
              <span className="mx-2 text-xs text-slate-500">{formatTimestamp(event.timestamp)}</span>
              {"agent" in event && event.agent ? (
                <span>
                  {` — ${event.agent}`}
                  {"position" in event && event.position && event.total ? ` (${event.position}/${event.total})` : ""}
                </span>
              ) : null}
              {event.type === "error" && event.error ? <span className="ml-2 text-red-600"> — {event.error}</span> : null}
              {event.type === "agent_failed" && event.error ? <span className="ml-2 text-red-600"> — {event.error}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {agentResponses?.length
            ? "Agent responses recorded. Re-run debate only if new clinical data is available."
            : "Awaiting kickoff. Assign agents automatically when you start the debate."}
        </p>
      )}

      {latestAgents.size > 0 ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Live agents</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {[...latestAgents.entries()].map(([agent, meta]) => (
              <div key={agent} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <p className="text-sm font-semibold text-[#1a3557]">{agent}</p>
                <p className="text-xs text-slate-500">
                  {meta.status} · {formatTimestamp(meta.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {consensus ? (
        <p className="text-xs text-emerald-600">Latest consensus generated · score {consensus.confidence_score}/100</p>
      ) : null}
    </Card>
  );
}
