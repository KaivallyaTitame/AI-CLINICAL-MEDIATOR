import { randomUUID } from "crypto";
import { openrouter } from "@/lib/openrouter";
import { getTemplateBySlug } from "@/lib/templates";
import type { AgentResponse, ConsensusReport, PatientCasePayload } from "@/lib/types";

const hasOpenrouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());

const MODEL_CHAIN: string[] = [
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

const EVIDENCE_GAP_SUFFIX =
  "If you do not have high-confidence evidence for a claim, explicitly state the evidence gap rather than speculating.";

const AGENT_PROMPTS: Record<string, string> = {
  "AI Surgeon": `You are a board-certified cardiothoracic/oncologic surgeon. Analyze this patient case strictly from a surgical perspective. Cite relevant surgical guidelines (e.g., NCCN, ACC/AHA). State clearly whether surgical intervention is indicated, the timing, risks, and contraindications. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Oncologist": `You are a medical oncologist specializing in systemic cancer therapies. Analyze this patient case and recommend a chemotherapy, immunotherapy, or targeted therapy plan. Reference the latest NCCN and ESMO guidelines. Include biomarker relevance and clinical trial eligibility. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Radiation Oncologist": `You are a radiation oncologist. Recommend whether radiotherapy is indicated, outline sequencing, toxicity trade-offs, and reference NCCN/ESTRO guidance. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Interventional Cardiologist": `You are an interventional cardiologist. Evaluate whether PCI/stenting is appropriate for this patient. Reference ACC/AHA and ESC guidelines. Provide SYNTAX score interpretation and mortality risk data. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Cardiac Surgeon": `You are a cardiac surgeon. Evaluate whether CABG is appropriate for this patient. Reference ACC/AHA guidelines. Compare long-term outcomes vs. PCI for this patient profile. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Clinical Pharmacologist": `You are a clinical pharmacologist. Review the patient's medication list and proposed treatment plans for dangerous drug-drug interactions, contraindications given comorbidities, and recommend safe alternatives. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Cardiologist": `You are a cardiologist. Evaluate cardiovascular disease burden, procedural risk, and guideline-directed medical therapy implications. ${EVIDENCE_GAP_SUFFIX}`,
  "AI Endocrinologist": `You are an endocrinologist. Evaluate metabolic disease, diabetes control, endocrine risks, and treatment timing implications. ${EVIDENCE_GAP_SUFFIX}`,
  "AI General Physician": `You are a general physician moderating overall medical complexity and triage. Identify the specialties most relevant to the case and summarize the highest-priority care concerns. ${EVIDENCE_GAP_SUFFIX}`,
};

const MODERATOR_PROMPT = `You are a senior clinical evidence synthesizer moderating a multidisciplinary team meeting. You have received independent analyses from multiple specialist AI agents. Your job is to: 1. Identify where agents AGREE and where they CONFLICT. 2. Resolve conflicts by citing the highest-quality clinical evidence available (RCTs, meta-analyses, NCCN/ACC/ESC/ESMO guidelines). 3. Produce a final Consensus Report with a mathematically weighted recommendation score. 4. Provide a ranked list of treatment options with evidence-strength ratings. 5. Flag any patient safety alerts (drug interactions, contraindications). 6. Be explicit: state which specialist's view prevails and WHY, using data. ${EVIDENCE_GAP_SUFFIX}`;

export function resolveAgents(casePayload: PatientCasePayload) {
  const template = getTemplateBySlug(casePayload.templateSlug);
  if (template && template.slug !== "mdt-meeting-prep") {
    return template.agents;
  }

  const defaults: Record<string, string[]> = {
    Oncology: ["AI Surgeon", "AI Oncologist", "AI Radiation Oncologist", "AI Clinical Pharmacologist"],
    Cardiology: ["AI Interventional Cardiologist", "AI Cardiac Surgeon", "AI Clinical Pharmacologist"],
    Multimorbidity: ["AI General Physician", "AI Cardiologist", "AI Oncologist", "AI Clinical Pharmacologist", "AI Endocrinologist"],
    "General MDT": ["AI General Physician", "AI Surgeon", "AI Oncologist", "AI Clinical Pharmacologist"],
  };

  return defaults[casePayload.caseType] ?? ["AI General Physician", "AI Clinical Pharmacologist"];
}

function buildCaseContext(casePayload: PatientCasePayload) {
  return JSON.stringify(casePayload, null, 2);
}

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function truncateText(value: string, maxLength = 600) {
  if (!value) {
    return value;
  }
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function summarizeAgentResponses(responses: AgentResponse[]) {
  return responses.map((response) => ({
    agent: response.agent,
    recommendation: truncateText(response.recommendation, 700),
    confidence_score: response.confidence_score,
    key_evidence: response.key_evidence.slice(0, 3),
    treatment_conflicts_flagged: response.treatment_conflicts_flagged.slice(0, 3),
    consensus_position: truncateText(response.consensus_position, 300),
  }));
}


function ensureConsensusShape(
  parsed: Partial<ConsensusReport>,
): ConsensusReport {
  return {
    consensus_recommendation: parsed.consensus_recommendation ?? "No consensus reached",
    confidence_score: parsed.confidence_score ?? 0,
    evidence_strength: parsed.evidence_strength ?? "Low",
    treatment_options_ranked: parsed.treatment_options_ranked ?? [],
    agent_agreement_summary: parsed.agent_agreement_summary ?? "",
    safety_alerts: parsed.safety_alerts ?? [],
    dissenting_views: parsed.dissenting_views ?? [],
    time_sensitivity: parsed.time_sensitivity ?? "Standard",
    suggested_next_steps: parsed.suggested_next_steps ?? [],
    unavailable_agents: parsed.unavailable_agents ?? [],
  };
}

const RATE_LIMIT_STATUS = 429;


function normalizeMessageContent(content: string | Array<{ text?: string }> | null | undefined) {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content.map((item) => item?.text ?? "").join("\n");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJsonFromOpenRouter<T>({
  model,
  systemPrompt,
  userContent,
  maxTokens,
  agentLabel,
}: {
  model: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  agentLabel: string;
}): Promise<T> {
  if (!hasOpenrouterKey) {
    throw new Error("OpenRouter API key is missing. Set OPENROUTER_API_KEY in .env.local and restart the dev server.");
  }

  const response = await openrouter.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
  });

  const messageContent = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
  if (!messageContent) {
    throw new Error(`OpenRouter returned empty content for ${agentLabel}.`);
  }

  const normalizedText = stripCodeFences(messageContent);
  return JSON.parse(normalizedText) as T;
}


async function invokeAgentSingle(agent: string, casePayload: PatientCasePayload, model: string): Promise<AgentResponse> {
  if (!hasOpenrouterKey) {
    throw new Error("OpenRouter API key is missing. Set OPENROUTER_API_KEY in .env.local and restart the dev server.");
  }

  const system = AGENT_PROMPTS[agent] ?? `${agent}. ${EVIDENCE_GAP_SUFFIX}`;
  const prompt = `Return JSON only with keys: agent, recommendation, confidence_score, key_evidence, risks_identified, treatment_conflicts_flagged, consensus_position. Patient case:\n${buildCaseContext(casePayload)}`;

  return await requestJsonFromOpenRouter<AgentResponse>({
    model,
    systemPrompt: system,
    userContent: prompt,
    maxTokens: 2000,
    agentLabel: agent,
  });
}

async function invokeAgentWithFallback(agent: string, casePayload: PatientCasePayload): Promise<AgentResponse> {
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    try {
      console.log(`[${agent}] Trying model ${i + 1}/${MODEL_CHAIN.length}: ${model}`);
      return await invokeAgentSingle(agent, casePayload, model);
    } catch (error: unknown) {
      const statusCode = (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const is404 = statusCode === 404 || message.includes("404") || message.includes("No endpoints");
      const is429 = statusCode === RATE_LIMIT_STATUS || message.includes("429");

      if (is404) {
        console.log(`[${agent}] 404 on ${model}, skipping to next model...`);
        continue;
      }
      if (is429 && i < MODEL_CHAIN.length - 1) {
        console.log(`[${agent}] 429 on ${model}, waiting 20s then trying next model...`);
        await delay(20000);
        continue;
      }
      if (i === MODEL_CHAIN.length - 1) {
        throw new Error(`[${agent}] All ${MODEL_CHAIN.length} models exhausted. Last error: ${message}`);
      }
      throw error;
    }
  }
  throw new Error(`[${agent}] All models in chain exhausted`);
}

async function invokeModerator(
  casePayload: PatientCasePayload,
  responses: AgentResponse[],
  model: string,
): Promise<ConsensusReport> {
  if (!hasOpenrouterKey) {
    throw new Error("OpenRouter API key is missing. Set OPENROUTER_API_KEY in .env.local and restart the dev server.");
  }

  const summarizedResponses = summarizeAgentResponses(responses);

  const parsed = await requestJsonFromOpenRouter<Partial<ConsensusReport>>({
    model,
    systemPrompt: MODERATOR_PROMPT,
    userContent: `Return JSON only with keys consensus_recommendation, confidence_score, evidence_strength, treatment_options_ranked, safety_alerts, dissenting_views, time_sensitivity, suggested_next_steps, agent_agreement_summary. Each treatment_options_ranked entry must include option, score, rationale, citations. Respond with valid JSON only.\n\nPatient case:\n${buildCaseContext(casePayload)}\n\nAgent responses (JSON array):\n${JSON.stringify(summarizedResponses, null, 2)}`,
    maxTokens: 3000,
    agentLabel: "Moderator",
  });
  return ensureConsensusShape(parsed);
}

export async function runDebate(casePayload: PatientCasePayload, onEvent?: (event: Record<string, unknown>) => void) {
  const agents = resolveAgents(casePayload);
  onEvent?.({ type: "start", agents });

  console.log("[OpenRouter] Model chain:", MODEL_CHAIN);

  const total = agents.length;
  const STAGGER_MS = 2000;

  const agentPromises = agents.map((agent, index) => {
    const position = index + 1;
    const eventId = randomUUID();
    return (async () => {
      await delay(index * STAGGER_MS);
      onEvent?.({ type: "agent_started", agent, id: eventId, position, total });
      try {
        const result = await invokeAgentWithFallback(agent, casePayload);
        onEvent?.({ type: "agent_completed", agent, result, position, total });
        console.log(`[${agent}] completed (${position}/${total})`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${agent}] all models failed:`, message);
        onEvent?.({
          type: "agent_failed",
          agent,
          error: message,
          position,
          total,
        });
        return null;
      }
    })();
  });

  const results = await Promise.all(agentPromises);
  const agentResponses = results.filter((r): r is AgentResponse => r !== null);

  console.log(`${agentResponses.length}/${total} agents succeeded. Starting Moderator...`);
  onEvent?.({ type: "moderator_started" });

  let consensus: ConsensusReport | null = null;

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    try {
      console.log(`[Moderator] Trying model ${i + 1}/${MODEL_CHAIN.length}: ${model}`);
      consensus = await invokeModerator(casePayload, agentResponses, model);
      break;
    } catch (error: unknown) {
      const statusCode = (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      const is404 = statusCode === 404 || message.includes("404") || message.includes("No endpoints");
      const is429 = statusCode === RATE_LIMIT_STATUS || message.includes("429");

      if (is404) {
        console.log(`[Moderator] 404 on ${model}, skipping...`);
        continue;
      }
      if (is429 && i < MODEL_CHAIN.length - 1) {
        console.log(`[Moderator] 429 on ${model}, waiting 20s...`);
        await delay(20000);
        continue;
      }
      if (i === MODEL_CHAIN.length - 1) {
        console.error("[Moderator] All models exhausted.", message);
        throw error;
      }
      throw error;
    }
  }

  if (!consensus) {
    throw new Error("Moderator failed to produce consensus — all models exhausted.");
  }

  onEvent?.({ type: "moderator_completed", consensus });

  return {
    agents,
    agentResponses,
    consensus,
  };
}
