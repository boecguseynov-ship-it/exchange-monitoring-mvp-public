import { NextRequest, NextResponse } from "next/server";
import { loadPublicOffers } from "@/lib/bestchange/service";

export const dynamic = "force-dynamic";

function readAmount(value: string | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromCode = searchParams.get("from") ?? "";
  const toCode = searchParams.get("to") ?? "";
  const amount = readAmount(searchParams.get("amount"));

  if (!fromCode || !toCode || amount <= 0 || fromCode === toCode) {
    return NextResponse.json({
      data: [],
      live: false,
      provider: "Validation",
      message: "Выберите разные валюты и сумму больше нуля"
    });
  }

  try {
    const result = await loadPublicOffers({ fromCode, toCode, amount });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Предложения временно недоступны";

    return NextResponse.json({
      data: [],
      live: false,
      provider: "Fallback",
      message
    });
  }
}
