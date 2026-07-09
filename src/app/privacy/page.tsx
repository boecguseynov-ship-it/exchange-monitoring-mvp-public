import { AppShell } from "@/components/app-shell";
import { LegalDocument } from "@/components/legal-document";
import { loadLegalPage, legalPages } from "@/lib/legal-pages";

export const metadata = {
  title: "Политика конфиденциальности — monik exchange"
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await loadLegalPage("privacy") ?? legalPages.privacy;
  return (
    <AppShell footer>
      <LegalDocument page={page} />
    </AppShell>
  );
}
