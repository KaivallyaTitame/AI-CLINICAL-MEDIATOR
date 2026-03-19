import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const original = await prisma.patientCase.findUnique({ where: { id } });
    if (!original) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const duplicate = await prisma.patientCase.create({
      data: {
        patientId: `COPY-${original.patientId}`.slice(0, 20),
        age: original.age,
        sex: original.sex,
        weight: original.weight,
        diagnosis: original.diagnosis,
        icd10Code: original.icd10Code,
        caseType: original.caseType,
        comorbidities: original.comorbidities,
        medications: original.medications,
        labResults: original.labResults ?? {},
        imagingSummary: original.imagingSummary,
        biopsyResults: original.biopsyResults,
        riskScores: original.riskScores ?? {},
        specialistViews: original.specialistViews ?? [],
        meetingType: original.meetingType,
        templateSlug: original.templateSlug,
        uploads: original.uploads ?? [],
        doctorId: session.user.id,
        status: "pending",
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    console.error("[duplicate] Error:", error);
    return NextResponse.json({ error: "Failed to duplicate case", detail: String(error) }, { status: 500 });
  }
}
