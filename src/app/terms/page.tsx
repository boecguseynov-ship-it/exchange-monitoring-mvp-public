import { AppShell } from "@/components/app-shell";
import { LegalDocument } from "@/components/legal-document";
import { legalPages } from "@/lib/legal-pages";

export const metadata = {
  title: "Условия использования — RateScope"
};

export default function TermsPage() {
  return (
    <AppShell footer>
      <LegalDocument page={legalPages.terms} />
    </AppShell>
  );
}
