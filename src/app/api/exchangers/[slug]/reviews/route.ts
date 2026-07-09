import { NextResponse } from "next/server";
import { ModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureExchangeForFeedback } from "@/lib/bestchange/service";

type ReviewRequestContext = {
  params: Promise<{ slug: string }>;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: ReviewRequestContext) {
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => null);
    const reference = cleanText(body?.reference);
    const text = cleanText(body?.body);
    const kind = cleanText(body?.kind) === "complaint" ? "complaint" : "review";
    const rating = Math.max(1, Math.min(5, Number(body?.rating ?? 5)));

    if (!reference || reference.length < 3 || text.length < 20 || !Number.isFinite(rating)) {
      return NextResponse.json(
        { message: "Заполните номер операции, оценку и текст от 20 символов." },
        { status: 400 }
      );
    }

    const exchange = await ensureExchangeForFeedback(slug);
    if (!exchange) {
      return NextResponse.json(
        { message: "Не удалось найти обменник для отзыва." },
        { status: 404 }
      );
    }

    if (kind === "complaint") {
      const complaint = await prisma.complaint.create({
        data: {
          exchangeId: exchange.id,
          transactionRef: reference,
          type: "PAYMENT_DELAY",
          message: text
        },
        select: { id: true }
      });
      await prisma.auditLog.create({
        data: {
          action: "COMPLAINT_CREATED",
          targetType: "COMPLAINT",
          targetId: complaint.id,
          details: exchange.name
        }
      }).catch(() => null);

      return NextResponse.json({
        id: complaint.id,
        message: "Жалоба отправлена на проверку."
      });
    }

    const review = await prisma.review.create({
      data: {
        exchangeId: exchange.id,
        transactionRef: reference,
        rating,
        body: text,
        status: ModerationStatus.PENDING
      },
      select: { id: true }
    });

    await prisma.auditLog.create({
      data: {
        action: "REVIEW_CREATED",
        targetType: "REVIEW",
        targetId: review.id,
        details: exchange.name
      }
    }).catch(() => null);

    return NextResponse.json({
      id: review.id,
      message: "Отзыв отправлен на модерацию."
    });
  } catch (error) {
    console.error("Review submit error:", error);
    return NextResponse.json(
      { message: "Не удалось отправить отзыв. Попробуйте позже или напишите через контакты." },
      { status: 500 }
    );
  }
}
