import { NextResponse } from "next/server";
import { CASE_TEMPLATES } from "@/lib/templates";

export async function GET() {
  return NextResponse.json(CASE_TEMPLATES);
}
