import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (path !== "anonymous" && path !== "signup") {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const jar = await cookies();
    jar.set("wd_path_chosen", path, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
