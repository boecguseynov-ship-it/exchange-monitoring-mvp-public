import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db/prisma";

export type AuthRole = "ADMIN" | "OWNER" | "USER";

export type AuthSession = {
  email: string;
  name: string;
  role: AuthRole;
  exchangeId?: string | null;
  exp: number;
};

const authCookieName = "ratescope_session";
const sessionMaxAgeSec = 60 * 60 * 24 * 7;

type AccountConfig = {
  email: string;
  name: string;
  password?: string;
  role: AuthRole;
};

function authSecret() {
  return process.env.RATESCOPE_AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.BESTCHANGE_API_KEY ||
    "ratescope-local-auth-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function configuredAccounts(): AccountConfig[] {
  const accounts: AccountConfig[] = [
    {
      email: process.env.RATESCOPE_ADMIN_EMAIL || "admin@monik.exchange",
      name: "Администратор",
      password: process.env.RATESCOPE_ADMIN_PASSWORD,
      role: "ADMIN"
    },
    {
      email: process.env.RATESCOPE_OWNER_EMAIL || "owner@monik.exchange",
      name: "Владелец",
      password: process.env.RATESCOPE_OWNER_PASSWORD,
      role: "OWNER"
    },
    {
      email: process.env.RATESCOPE_USER_EMAIL || "user@monik.exchange",
      name: "Пользователь",
      password: process.env.RATESCOPE_USER_PASSWORD,
      role: "USER"
    }
  ];
  return accounts.filter((account) => Boolean(account.password));
}

export function authAccountsReady() {
  return configuredAccounts().length > 0;
}

export async function createAuthSession(account: {
  email: string;
  name: string;
  role: AuthRole;
  exchangeId?: string | null;
}) {
  const session: AuthSession = {
    email: account.email,
    name: account.name,
    role: account.role,
    exchangeId: account.exchangeId ?? null,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSec
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSec,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(authCookieName);
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;
    if (!session.email || !session.role || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check configured accounts in .env
  const account = configuredAccounts().find((item) => item.email.toLowerCase() === normalizedEmail);
  if (account?.password) {
    return safeEqual(password, account.password) ? account : null;
  }

  // 2. Check database users
  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (user && user.passwordHash && user.role) {
      const match = await argon2.verify(user.passwordHash, password);
      if (match) {
        return {
          email: user.email!,
          name: user.name || user.email!,
          role: user.role as AuthRole,
          exchangeId: user.exchangeId
        };
      }
    }
  } catch (error) {
    console.error("Database authentication error:", error);
  }

  return null;
}

export async function requireAuthRole(roles: AuthRole[], nextPath: string) {
  const session = await getAuthSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!roles.includes(session.role)) redirect("/login?error=forbidden");
  return session;
}

export async function assertAuthRole(roles: AuthRole[]) {
  const session = await getAuthSession();
  if (!session || !roles.includes(session.role)) {
    throw new Error("Недостаточно прав для этого действия");
  }
  return session;
}
