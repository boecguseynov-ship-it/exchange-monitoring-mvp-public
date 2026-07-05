import { NextResponse } from "next/server";
import { loadPublicAssets } from "@/lib/bestchange/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const assets = await loadPublicAssets();
  return NextResponse.json(assets);
}
