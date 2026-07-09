import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeText(body.email);
    const subject = normalizeText(body.subject);
    const message = normalizeText(body.message);

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: "Пожалуйста, заполните все поля формы." },
        { status: 400 },
      );
    }

    await prisma.contactMessage.create({
      data: {
        email,
        subject,
        message
      }
    }).catch(() => null);

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const receiver = process.env.CONTACT_RECEIVER || "support@monik.exchange";

    if (!user || !pass) {
      return NextResponse.json(
        { error: "Почта сайта пока не настроена. Пожалуйста, попробуйте позже." },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

    try {
      await transporter.sendMail({
        from: `"monik exchange" <${user}>`,
        to: receiver,
        replyTo: email,
        subject: `[monik exchange] ${subject}`,
        text: [
          "Новое обращение с сайта monik exchange",
          "",
          `Отправитель: ${email}`,
          `Тема: ${subject}`,
          "",
          "Сообщение:",
          message,
        ].join("\n"),
        html: `
          <h2>Новое обращение с сайта monik exchange</h2>
          <p><strong>Отправитель:</strong> ${safeEmail}</p>
          <p><strong>Тема:</strong> ${safeSubject}</p>
          <p><strong>Сообщение:</strong></p>
          <blockquote style="border-left:4px solid #f97316;margin:12px 0;padding:10px 14px;background:#fff7ed;">
            ${safeMessage}
          </blockquote>
        `,
      });
    } catch (mailError) {
      console.warn("Failed to send contact email notification (saved message in DB):", mailError);
    }

    await prisma.auditLog.create({
      data: {
        action: "CONTACT_MESSAGE_CREATED",
        targetType: "CONTACT_MESSAGE",
        details: subject
      }
    }).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact email error:", error);
    return NextResponse.json(
      { error: "Не удалось отправить сообщение. Пожалуйста, попробуйте позже." },
      { status: 500 },
    );
  }
}
