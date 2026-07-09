import { AppShell } from "@/components/app-shell";
import { LegalDocument } from "@/components/legal-document";
import { loadLegalPage, legalPages } from "@/lib/legal-pages";

export const metadata = {
  title: "Условия использования — monik exchange"
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const page = await loadLegalPage("terms") ?? legalPages.terms;
  return (
    <AppShell footer>
      <LegalDocument page={page} />
    </AppShell>
  );
}
