import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { callOpenRouter, FREE_MODELS } from "@/lib/openrouter";
import { riskScoresResponseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const RISK_SYSTEM_PROMPT = `You are a clinical risk scoring agent. Given the patient's diagnosis, labs, age, sex, and medications, compute ONLY the clinically relevant risk scores for this specific case type.

Examples by case type:
- Cardiac surgery: STS Score, EuroSCORE II
- Atrial fibrillation: CHA2DS2-VASc, HAS-BLED
- ACS/NSTEMI: GRACE Score, TIMI Score
- Oncology: TNM Staging, ECOG Performance Status
- Multimorbidity: Charlson Comorbidity Index

Return ONLY valid JSON. No markdown. No explanation. No preamble.

[
  {
    "name": string,
    "value": string,
    "tier": "Low" | "Intermediate" | "High",
    "rationale": string
  }
]`;

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { diagnosis, labs, age, sex, medications, caseType } = body;

    if (!diagnosis) {
      return NextResponse.json({ error: "Diagnosis is required" }, { status: 400 });
    }

    const userMessage = `Patient details:
- Age: ${age ?? "Unknown"}
- Sex: ${sex ?? "Unknown"}
- Diagnosis: ${diagnosis}
- Case type: ${caseType ?? "General"}
- Medications: ${Array.isArray(medications) && medications.length ? medications.join(", ") : "None listed"}
- Lab results: ${labs && typeof labs === "object" ? JSON.stringify(labs) : "None listed"}

Compute the clinically relevant risk scores for this patient.`;

    const rawResponse = await callOpenRouter({
      model: FREE_MODELS.TEXT,
      systemPrompt: RISK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const processingTimeMs = Date.now() - startTime;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawResponse));
    } catch {
      const fallbackCheck = JSON.parse(rawResponse).fallback;
      if (fallbackCheck) {
        return NextResponse.json({
          success: false,
          fallback: true,
          data: [],
          model: FREE_MODELS.TEXT,
          processingTimeMs,
          error: "Risk computation unavailable — please enter scores manually",
        });
      }
      return NextResponse.json({
        success: false,
        fallback: false,
        data: [],
        model: FREE_MODELS.TEXT,
        processingTimeMs,
        error: "Failed to parse risk scores response",
      });
    }

    const validated = riskScoresResponseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json({
        success: false,
        fallback: false,
        data: Array.isArray(parsed) ? parsed : [],
        model: FREE_MODELS.TEXT,
        processingTimeMs,
        error: "Risk scores partially validated",
      });
    }

    return NextResponse.json({
      success: true,
      data: validated.data,
      model: FREE_MODELS.TEXT,
      processingTimeMs,
      fallback: false,
    });
  } catch (error) {
    console.error("[compute-risk] Error:", error);
    return NextResponse.json({
      success: false,
      fallback: true,
      data: [],
      processingTimeMs: Date.now() - startTime,
      error: "Risk computation unavailable — please enter scores manually",
    }, { status: 500 });
  }
}
