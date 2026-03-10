import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { runDebate } from "@/lib/agents";
import type { PatientCasePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await context.params;
  const patientCase = await prisma.patientCase.findUnique({ where: { id } });

  if (!patientCase) {
    return new Response(JSON.stringify({ error: "Case not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (patientCase.status === "confirmed") {
    return new Response(JSON.stringify({ error: "Confirmed cases cannot be re-analyzed" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (patientCase.agentResponses) {
    return new Response(JSON.stringify({ error: "Agent responses already recorded for this case" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const payload: PatientCasePayload = {
        patientId: patientCase.patientId,
        age: patientCase.age,
        sex: patientCase.sex,
        weight: patientCase.weight ?? undefined,
        diagnosis: patientCase.diagnosis,
        caseType: patientCase.caseType,
        comorbidities: patientCase.comorbidities,
        medications: patientCase.medications,
        labResults: (patientCase.labResults as Record<string, string>) ?? {},
        imagingSummary: patientCase.imagingSummary ?? undefined,
        biopsyResults: patientCase.biopsyResults ?? undefined,
        riskScores: (patientCase.riskScores as Record<string, string>) ?? {},
        specialistViews: (patientCase.specialistViews as Array<{ specialist: string; opinion: string }>) ?? [],
        meetingType: patientCase.meetingType,
        templateSlug: patientCase.templateSlug ?? undefined,
        uploads: (patientCase.uploads as Array<{ name: string; type: string; content: string }>) ?? [],
      };

      try {
        await prisma.patientCase.update({
          where: { id: patientCase.id },
          data: { status: "analyzing" },
        });

        const result = await runDebate(payload, (event) =>
          sendEvent({ ...event, timestamp: new Date().toISOString() }),
        );

        await prisma.patientCase.update({
          where: { id: patientCase.id },
          data: {
            status: "consensus_ready",
            agentResponses: result.agentResponses,
            consensusReport: result.consensus,
          },
        });

        sendEvent({ type: "complete", consensus: result.consensus });
      } catch (error) {
        await prisma.patientCase.update({
          where: { id: patientCase.id },
          data: { status: "pending" },
        });
        const message = error instanceof Error ? error.message : String(error);
        sendEvent({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
