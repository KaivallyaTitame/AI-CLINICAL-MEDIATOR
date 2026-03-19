import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { callOpenRouter, FREE_MODELS } from "@/lib/openrouter";
import { drugInteractionsResponseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const INTERACTION_SYSTEM_PROMPT = `You are a clinical pharmacology agent. Given this list of medications, identify all clinically significant drug-drug interactions.

Return ONLY valid JSON. No markdown. No preamble.

[
  {
    "drug1": string,
    "drug2": string,
    "severity": "Major" | "Moderate" | "Minor",
    "description": string
  }
]

If no interactions exist, return an empty array: []`;

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
    const { medications } = body;

    if (!Array.isArray(medications) || medications.length < 2) {
      return NextResponse.json({ error: "At least 2 medications required" }, { status: 400 });
    }

    const userMessage = `Medications list:\n${medications.map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}\n\nIdentify all clinically significant drug-drug interactions.`;

    const rawResponse = await callOpenRouter({
      model: FREE_MODELS.TEXT,
      systemPrompt: INTERACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const processingTimeMs = Date.now() - startTime;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawResponse));
    } catch {
      try {
        const fallbackCheck = JSON.parse(rawResponse).fallback;
        if (fallbackCheck) {
          return NextResponse.json({
            success: false,
            fallback: true,
            data: [],
            model: FREE_MODELS.TEXT,
            processingTimeMs,
            error: "Interaction check unavailable — verify with a clinical pharmacist",
          });
        }
      } catch {
        // double parse failure
      }
      return NextResponse.json({
        success: false,
        fallback: false,
        data: [],
        model: FREE_MODELS.TEXT,
        processingTimeMs,
        error: "Failed to parse interaction response",
      });
    }

    const validated = drugInteractionsResponseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json({
        success: false,
        fallback: false,
        data: Array.isArray(parsed) ? parsed : [],
        model: FREE_MODELS.TEXT,
        processingTimeMs,
        error: "Interaction data partially validated",
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
    console.error("[check-interactions] Error:", error);
    return NextResponse.json({
      success: false,
      fallback: true,
      data: [],
      processingTimeMs: Date.now() - startTime,
      error: "Interaction check unavailable — verify with a clinical pharmacist",
    }, { status: 500 });
  }
}
