import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getTemplateBySlug } from "@/lib/templates";
import type { AgentResponse, ConsensusReport, PatientCasePayload } from "@/lib/types";

const rawGeminiApiKey = process.env.GEMINI_API_KEY?.trim();
const geminiApiKey =
  rawGeminiApiKey && !["demo_placeholder", "your_gemini_key", "your_gemini_api_key"].includes(rawGeminiApiKey)
    ? rawGeminiApiKey
    : null;

const MODEL = "gemini-2.0-flash";
const EVIDENCE_GAP_SUFFIX =
  "If you do not have high-confidence evidence for a claim, explicitly state the evidence gap rather than speculating.";

// Initialize Gemini client
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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
    confidence_score: response.confidence_score,
    recommendation: truncateText(response.recommendation, 700),
    consensus_position: truncateText(response.consensus_position, 300),
    key_evidence: response.key_evidence.slice(0, 3),
    risks_identified: response.risks_identified.slice(0, 3),
    treatment_conflicts_flagged: response.treatment_conflicts_flagged.slice(0, 3),
    ...(response.error ? { error: truncateText(response.error, 300) } : {}),
  }));
}

function buildFallbackConsensusReport(casePayload: PatientCasePayload, responses: AgentResponse[]): ConsensusReport {
  const fallbackOptions = responses.slice(0, 3).map((item, index) => ({
    option: item.consensus_position,
    score: Math.max(50, item.confidence_score - index * 5),
    rationale: item.recommendation,
    citations: item.key_evidence,
  }));

  return {
    consensus_recommendation: `Consensus scaffold for ${casePayload.diagnosis}: reconcile specialist inputs and confirm with MDT leadership.`,
    confidence_score: Math.round(
      responses.reduce((sum, item) => sum + item.confidence_score, 0) / Math.max(responses.length, 1),
    ),
    evidence_strength: "Moderate",
    treatment_options_ranked: fallbackOptions,
    agent_agreement_summary: responses.map((item) => `${item.agent}: ${item.consensus_position}`).join(" "),
    safety_alerts: responses.flatMap((item) => item.risks_identified).slice(0, 5),
    dissenting_views: responses.flatMap((item) => item.treatment_conflicts_flagged).slice(0, 4),
    time_sensitivity: "Standard",
    suggested_next_steps: ["Review fallback output in MDT", "Confirm guideline citations", "Document final attending decision"],
    unavailable_agents: responses.filter((item) => item.error).map((item) => item.agent),
  };
}

function ensureConsensusShape(
  parsed: Partial<ConsensusReport>,
  casePayload: PatientCasePayload,
  responses: AgentResponse[],
): ConsensusReport {
  const fallback = buildFallbackConsensusReport(casePayload, responses);

  return {
    ...fallback,
    ...parsed,
    consensus_recommendation: parsed.consensus_recommendation ?? fallback.consensus_recommendation,
    confidence_score: parsed.confidence_score ?? fallback.confidence_score,
    evidence_strength: parsed.evidence_strength ?? fallback.evidence_strength,
    treatment_options_ranked:
      parsed.treatment_options_ranked && parsed.treatment_options_ranked.length > 0
        ? parsed.treatment_options_ranked
        : fallback.treatment_options_ranked,
    agent_agreement_summary: parsed.agent_agreement_summary ?? fallback.agent_agreement_summary,
    safety_alerts: parsed.safety_alerts ?? fallback.safety_alerts,
    dissenting_views: parsed.dissenting_views ?? fallback.dissenting_views,
    time_sensitivity: parsed.time_sensitivity ?? fallback.time_sensitivity,
    suggested_next_steps: parsed.suggested_next_steps ?? fallback.suggested_next_steps,
    unavailable_agents: parsed.unavailable_agents ?? fallback.unavailable_agents,
  };
}

async function invokeGeminiJson<T>({
  system,
  prompt,
  maxOutputTokens,
}: {
  system: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<T> {
  if (!genAI) {
    throw new Error("Gemini API key is missing. Set GEMINI_API_KEY in .env.local and restart the dev server.");
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: system,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Gemini returned no text content.");
    }

    const normalizedText = stripCodeFences(text);

    try {
      return JSON.parse(normalizedText) as T;
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${truncateText(normalizedText, 500)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API call failed: ${message}`);
  }
}

function fallbackAgentResponse(agent: string, casePayload: PatientCasePayload): AgentResponse {
  return {
    agent,
    recommendation: `Fallback analysis for ${agent}: prioritize formal specialist review for ${casePayload.diagnosis}.`,
    confidence_score: 55,
    key_evidence: ["Evidence gap declared: live Gemini API unavailable or placeholder key configured; running in local scaffold mode."],
    risks_identified: casePayload.comorbidities.slice(0, 3),
    treatment_conflicts_flagged: ["Automated fallback mode should not be treated as clinical advice."],
    consensus_position: `${agent} requests human validation before action.`,
  };
}

async function invokeAgent(agent: string, casePayload: PatientCasePayload): Promise<AgentResponse> {
  const system = AGENT_PROMPTS[agent] ?? `${agent}. ${EVIDENCE_GAP_SUFFIX}`;
  const prompt = `Return JSON only with keys: agent, recommendation, confidence_score, key_evidence, risks_identified, treatment_conflicts_flagged, consensus_position. Patient case:\n${buildCaseContext(casePayload)}`;

  if (!geminiApiKey) {
    return fallbackAgentResponse(agent, casePayload);
  }

  try {
    return await invokeGeminiJson<AgentResponse>({
      system,
      prompt,
      maxOutputTokens: 1400,
    });
  } catch (error) {
    return {
      ...fallbackAgentResponse(agent, casePayload),
      error: String(error),
    };
  }
}

async function invokeModerator(casePayload: PatientCasePayload, responses: AgentResponse[]): Promise<ConsensusReport> {
  if (!geminiApiKey) {
    return buildFallbackConsensusReport(casePayload, responses);
  }

  const summarizedResponses = summarizeAgentResponses(responses);

  try {
    const parsed = await invokeGeminiJson<Partial<ConsensusReport>>({
      system: MODERATOR_PROMPT,
      prompt: `Return JSON only with keys consensus_recommendation, confidence_score, evidence_strength, treatment_options_ranked, safety_alerts, dissenting_views, time_sensitivity, suggested_next_steps, agent_agreement_summary. Each treatment_options_ranked entry must include option, score, rationale, citations. Respond with valid JSON only.\n\nPatient case:\n${buildCaseContext(casePayload)}\n\nAgent responses (JSON array):\n${JSON.stringify(summarizedResponses, null, 2)}`,
      maxOutputTokens: 1800,
    });
    return ensureConsensusShape(parsed, casePayload, responses);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("api key") || message.toLowerCase().includes("permission denied")) {
      throw new Error("Moderator call failed: Gemini API key is invalid. Update GEMINI_API_KEY in .env.local with a real key and restart the dev server.");
    }
    console.error("Moderator invocation failed", error);
    throw new Error(`Moderator call failed: ${message}`);
  }
}

export async function runDebate(casePayload: PatientCasePayload, onEvent?: (event: Record<string, unknown>) => void) {
  const agents = resolveAgents(casePayload);
  onEvent?.({ type: "start", agents });

  const settled = await Promise.all(
    agents.map(async (agent) => {
      onEvent?.({ type: "agent_started", agent, id: randomUUID() });
      const result = await invokeAgent(agent, casePayload);
      onEvent?.({ type: "agent_completed", agent, result });
      return result;
    }),
  );

  onEvent?.({ type: "moderator_started" });
  const consensus = await invokeModerator(casePayload, settled);
  onEvent?.({ type: "moderator_completed", consensus });

  return {
    agents,
    agentResponses: settled,
    consensus,
  };
}
