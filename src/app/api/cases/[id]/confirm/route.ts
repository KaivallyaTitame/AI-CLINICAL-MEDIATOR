import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { confirmCaseSchema } from "@/lib/validation";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.patientCase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (existing.status === "confirmed") {
    return NextResponse.json({ error: "Confirmed cases are immutable" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = confirmCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.patientCase.update({
    where: { id },
    data: {
      status: "confirmed",
      confirmedBy: parsed.data.confirmedBy.join(", "),
      confirmedAt: new Date(),
      consensusReport: {
        ...(existing.consensusReport as Record<string, unknown> | null),
        finalPlan: parsed.data.finalPlan,
      },
    },
  });

  return NextResponse.json(updated);
}
