import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const provider = authOptions.providers[0] as any;
    const result = await provider.options.authorize(
      { civilId: "2016", password: "2016" },
      {} as any
    );
    return NextResponse.json({
      authorizeResult: result ? { id: result.id, name: result.name, role: result.role } : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) }, { status: 500 });
  }
}
