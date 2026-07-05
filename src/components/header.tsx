"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isNavigationItemActive, publicNavigation } from "@/features/public-content/content";
import { Logo } from "./logo";

type SessionPayload = {
  user?: {
    role?: string;
  };
};

function dashboardHref(role: string | undefined) {
  if (role === "ADMIN" || role === "MODERATOR") return "/admin";
  if (role === "OWNER") return "/dashboard/owner";
  if (role === "USER") return "/dashboard";
  return "/login";
}

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionRole, setSessionRole] = useState<string>();

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionPayload>)
      .then((session) => {
        if (active) setSessionRole(session.user?.role);
      })
      .catch(() => {
        if (active) setSessionRole(undefined);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const accountHref = dashboardHref(sessionRole);
  const accountLabel = sessionRole ? "Кабинет" : "Войти";

  return (
    <header className="topbar">
      <Logo />
      <nav className="mainNav" aria-label="Основная навигация">
        {publicNavigation.map((item) => (
          <Link className={isNavigationItemActive(pathname, item.href) ? "active" : undefined} href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="headerActions">
        <Link className="loginButton" href={accountHref}>{accountLabel}</Link>
        {sessionRole && (
          <button className="logoutButton" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
            Выйти
          </button>
        )}
        <button
          className="menuButton"
          type="button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="mobileNav" aria-label="Мобильная навигация">
          {publicNavigation.map((item) => (
            <Link
              className={isNavigationItemActive(pathname, item.href) ? "active" : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href={accountHref} onClick={() => setMenuOpen(false)}>{accountLabel}</Link>
          {sessionRole && <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>Выйти</button>}
          <Link href="/api-docs" onClick={() => setMenuOpen(false)}>API</Link>
        </nav>
      )}
    </header>
  );
}
