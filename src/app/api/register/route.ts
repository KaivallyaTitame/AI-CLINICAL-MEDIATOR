import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.doctor.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Doctor already exists" }, { status: 409 });
    }

    const doctor = await prisma.doctor.create({
      data: {
        ...parsed.data,
        password: await hashPassword(parsed.data.password),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(doctor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to register doctor", detail: String(error) }, { status: 500 });
  }
}
