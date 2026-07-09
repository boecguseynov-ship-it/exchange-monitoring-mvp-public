import { Header } from "./header";
import { SiteFooter } from "./site-footer";
import { AdBanner } from "./ad-banner";

export function AppShell({
  sidebar,
  footer = false,
  className,
  siteBanner = true,
  children
}: {
  sidebar?: React.ReactNode;
  footer?: boolean;
  className?: string;
  siteBanner?: boolean;
  children: React.ReactNode;
}) {
  const appClassName = [
    "app",
    "appMonitoringGreen",
    sidebar ? "appWithSidebar" : "",
    className ?? ""
  ].filter(Boolean).join(" ");

  return (
    <div className={appClassName}>
      <Header />
      {siteBanner && <AdBanner placement="site-top" />}
      {sidebar}
      <main className={sidebar ? "mainWithSidebar" : "mainStandalone"}>{children}</main>
      {footer && <SiteFooter />}
    </div>
  );
}
