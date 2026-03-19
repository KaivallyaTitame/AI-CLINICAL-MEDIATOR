import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.patientCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (existing.status === "confirmed") {
      return NextResponse.json({ error: "Confirmed cases cannot be edited" }, { status: 409 });
    }

    // Touch the updatedAt timestamp to record draft save
    const updated = await prisma.patientCase.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ saved: true, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("[draft] Error:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
