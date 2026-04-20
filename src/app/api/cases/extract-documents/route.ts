import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { callOpenRouter, FREE_MODELS } from "@/lib/openrouter";
import { extractedCaseDataSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const EXTRACTION_SYSTEM_PROMPT = `You are a clinical document intelligence agent. Your ONLY job is to extract structured clinical data from medical documents with maximum accuracy.

Return ONLY a valid JSON object. No markdown. No explanation. No preamble. Pure JSON only.

Return this exact structure (use null for missing fields, empty arrays for missing lists):
{
  "primaryDiagnosis": string | null,
  "icd10Code": string | null,
  "patientAge": number | null,
  "patientSex": "Male" | "Female" | "Other" | null,
  "medications": string[],
  "labs": [
    { "name": string, "value": string, "unit": string, "referenceRange": string | null }
  ],
  "imagingSummary": string | null,
  "biopsyPathology": string | null,
  "specialistOpinions": [
    { "specialty": string, "clinicianName": string | null, "summary": string }
  ],
  "riskFactors": string[],
  "confidence": {
    "primaryDiagnosis": number,
    "medications": number,
    "labs": number,
    "imagingSummary": number,
    "biopsyPathology": number,
    "specialistOpinions": number,
    "overall": number
  },
  "sourceDocuments": string[],
  "extractionWarnings": string[]
}

Confidence scores must be between 0 and 1.
List in extractionWarnings any fields where data was ambiguous or possibly incomplete.`;

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer), {
      standardFontDataUrl: "https://unpkg.com/pdfjs-dist@latest/standard_fonts/",
    });
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text || !text.trim()) {
      console.warn("[extractTextFromPdf] PDF parsed but no text extracted — may be scanned/image PDF");
    }
    return text;
  } catch (err) {
    console.error("[extractTextFromPdf] unpdf failed:", err);
    throw new Error(`PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

type ScopeFilter = "all" | "labs" | "imaging" | "biopsy" | "specialistOpinion";

function buildScopeInstruction(scope: ScopeFilter): string {
  if (scope === "all") return "Extract ALL available clinical data from the document.";
  if (scope === "labs") return "Focus ONLY on extracting laboratory results. Populate the 'labs' array thoroughly. Other fields can be null/empty.";
  if (scope === "imaging") return "Focus ONLY on extracting imaging/radiology findings. Populate 'imagingSummary' thoroughly. Other fields can be null/empty.";
  if (scope === "biopsy") return "Focus ONLY on extracting biopsy/pathology findings. Populate 'biopsyPathology' thoroughly. Other fields can be null/empty.";
  if (scope === "specialistOpinion") return "Focus ONLY on extracting specialist/referral opinions. Populate 'specialistOpinions' array thoroughly. Other fields can be null/empty.";
  return "Extract ALL available clinical data from the document.";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const scope = (formData.get("scope") as ScopeFilter) || "all";
    const caseType = (formData.get("caseType") as string) || "";

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    const textChunks: string[] = [];
    const imagePayloads: Array<{ base64: string; mimeType: string; filename: string }> = [];
    const fileNames: string[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Accepted: PDF, DOCX, JPG, PNG` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 20MB limit` },
          { status: 400 },
        );
      }

      fileNames.push(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf") {
        const text = await extractTextFromPdf(buffer);
        textChunks.push(`--- Document: ${file.name} ---\n${text}`);
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const text = await extractTextFromDocx(buffer);
        textChunks.push(`--- Document: ${file.name} ---\n${text}`);
      } else if (file.type === "image/jpeg" || file.type === "image/png") {
        const base64 = buffer.toString("base64");
        imagePayloads.push({ base64, mimeType: file.type, filename: file.name });
      }
    }

    let rawResponse: string;

    const scopeInstruction = buildScopeInstruction(scope);
    const caseContext = caseType ? `\nCase type context: ${caseType}` : "";

    if (textChunks.length > 0 && imagePayloads.length === 0) {
      rawResponse = await callOpenRouter({
        model: FREE_MODELS.TEXT,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 4096,
        messages: [
          {
            role: "user",
            content: `${scopeInstruction}${caseContext}\n\nDocuments:\n${textChunks.join("\n\n")}`,
          },
        ],
      });
    } else if (imagePayloads.length > 0 && textChunks.length === 0) {
      const imageContent: unknown[] = [
        { type: "text", text: `${scopeInstruction}${caseContext}\n\nExtract clinical data from the following scanned document image(s).` },
      ];
      for (const img of imagePayloads) {
        imageContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      rawResponse = await callOpenRouter({
        model: FREE_MODELS.VISION,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 4096,
        messages: [{ role: "user", content: imageContent }],
      });
    } else {
      const mixedContent: unknown[] = [
        { type: "text", text: `${scopeInstruction}${caseContext}\n\nText documents:\n${textChunks.join("\n\n")}` },
      ];
      for (const img of imagePayloads) {
        mixedContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      rawResponse = await callOpenRouter({
        model: FREE_MODELS.VISION,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 4096,
        messages: [{ role: "user", content: mixedContent }],
      });
    }

    const processingTimeMs = Date.now() - startTime;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawResponse));
    } catch {
      // Check if the raw response is a fallback object
      try {
        const fallbackCheck = JSON.parse(rawResponse);
        if (fallbackCheck?.fallback) {
          return NextResponse.json({
            success: false,
            fallback: true,
            data: null,
            filesProcessed: files.length,
            processingTimeMs,
            error: "Extraction unavailable — please enter data manually",
          });
        }
      } catch {
        // rawResponse is not valid JSON at all (likely truncated)
        console.error("[extract-documents] Truncated or invalid AI response, length:", rawResponse.length);
      }
      return NextResponse.json({
        success: false,
        fallback: false,
        data: null,
        filesProcessed: files.length,
        processingTimeMs,
        error: "Extraction failed — AI response was truncated or invalid",
      });
    }

    const validated = extractedCaseDataSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json({
        success: false,
        fallback: false,
        data: parsed,
        model: textChunks.length > 0 ? FREE_MODELS.TEXT : FREE_MODELS.VISION,
        filesProcessed: files.length,
        processingTimeMs,
        error: "Extraction partially succeeded — some fields did not validate",
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...validated.data, sourceDocuments: fileNames },
      model: textChunks.length > 0 ? FREE_MODELS.TEXT : FREE_MODELS.VISION,
      filesProcessed: files.length,
      processingTimeMs,
      fallback: false,
    });
  } catch (error) {
    console.error("[extract-documents] Error:", error);
    return NextResponse.json({
      success: false,
      fallback: true,
      data: null,
      filesProcessed: 0,
      processingTimeMs: Date.now() - startTime,
      error: "Extraction unavailable — please enter data manually",
    }, { status: 500 });
  }
}
