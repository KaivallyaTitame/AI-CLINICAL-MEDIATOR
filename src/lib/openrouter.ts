import OpenAI from "openai";

// ── Active provider: OpenAI ──────────────────────────────────────────
export const openai = new OpenAI({
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// Re-export under the old name so agents/index.ts keeps working
export const openrouter = openai;

export interface OpenRouterOptions {
  model: string;
  messages: { role: string; content: unknown }[];
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.3;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;

const FALLBACK_RESPONSE = JSON.stringify({
  fallback: true,
  error: "Extraction unavailable — please enter data manually",
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const {
    model,
    messages,
    systemPrompt,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[callOpenAI] OPENAI_API_KEY is not set");
    return FALLBACK_RESPONSE;
  }

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: maxTokens,
    temperature,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    const start = Date.now();
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers,
        body,
      });

      const latency = Date.now() - start;
      if (process.env.NODE_ENV === "development") {
        console.log(`[callOpenAI] model=${model} latency=${latency}ms status=${response.status} attempt=${attempt + 1}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        console.error(`[callOpenAI] HTTP ${response.status}: ${errorText}`);
        if (attempt < RETRY_COUNT) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        return FALLBACK_RESPONSE;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        console.error("[callOpenAI] Empty content in response");
        return FALLBACK_RESPONSE;
      }
      return typeof content === "string" ? content : JSON.stringify(content);
    } catch (error) {
      const latency = Date.now() - start;
      console.error(`[callOpenAI] Network error attempt=${attempt + 1} latency=${latency}ms:`, error);
      if (attempt < RETRY_COUNT) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      return FALLBACK_RESPONSE;
    }
  }

  return FALLBACK_RESPONSE;
}

export const FREE_MODELS = {
  TEXT: "gpt-4o-mini",
  VISION: "gpt-4o-mini",
} as const;

// ── Commented-out OpenRouter config (preserved for future use) ────────
// export const openrouter = new OpenAI({
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: process.env.OPENROUTER_API_KEY,
//   defaultHeaders: {
//     "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
//     "X-Title": "AI Clinical Mediator",
//   },
// });
// const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// export const FREE_MODELS = {
//   TEXT: "nous/hermes-3-405b-instruct",
//   VISION: "google/gemma-3-12b-it",
// } as const;
