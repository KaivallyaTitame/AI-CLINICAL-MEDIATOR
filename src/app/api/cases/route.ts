import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { patientCaseSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 10;

  const where = query
    ? {
        OR: [
          { patientId: { contains: query, mode: "insensitive" as const } },
          { diagnosis: { contains: query, mode: "insensitive" as const } },
          { caseType: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.patientCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patientCase.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = patientCaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.patientCase.create({
      data: {
        patientId: parsed.data.patientId || randomUUID(),
        age: parsed.data.age,
        sex: parsed.data.sex,
        weight: parsed.data.weight,
        diagnosis: parsed.data.diagnosis,
        caseType: parsed.data.caseType,
        comorbidities: parsed.data.comorbidities,
        medications: parsed.data.medications,
        labResults: parsed.data.labResults,
        imagingSummary: parsed.data.imagingSummary,
        biopsyResults: parsed.data.biopsyResults,
        riskScores: parsed.data.riskScores,
        specialistViews: parsed.data.specialistViews,
        meetingType: parsed.data.meetingType,
        templateSlug: parsed.data.templateSlug,
        uploads: parsed.data.uploads,
        doctorId: session.user.id,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create case", detail: String(error) }, { status: 500 });
  }
}
