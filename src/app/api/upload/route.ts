import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    return NextResponse.json({
      id: randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      content: base64,
    });
  } catch (error) {
    return NextResponse.json({ error: "Upload failed", detail: String(error) }, { status: 500 });
  }
}
