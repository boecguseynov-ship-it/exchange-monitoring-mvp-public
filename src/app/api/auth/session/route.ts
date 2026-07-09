import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();

  return NextResponse.json({
    user: session
      ? {
          email: session.email,
          id: session.email,
          name: session.name,
          role: session.role
        }
      : null,
    expires: session ? new Date(session.exp * 1000).toISOString() : new Date(0).toISOString()
  });
}
