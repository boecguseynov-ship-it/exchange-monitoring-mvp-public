import { Header } from "./header";
import { SiteFooter } from "./site-footer";

export function AppShell({
  sidebar,
  footer = false,
  children
}: {
  sidebar?: React.ReactNode;
  footer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={sidebar ? "app appWithSidebar" : "app"}>
      <Header />
      {sidebar}
      <main className={sidebar ? "mainWithSidebar" : "mainStandalone"}>{children}</main>
      {footer && <SiteFooter />}
    </div>
  );
}
