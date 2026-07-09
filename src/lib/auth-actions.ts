"use server";

import { redirect } from "next/navigation";
import { authenticate, clearAuthSession, createAuthSession } from "@/lib/auth";

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const account = await authenticate(email, password);

  if (!account) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  await createAuthSession(account);
  redirect(next);
}

export async function logoutAction() {
  await clearAuthSession();
  redirect("/");
}
