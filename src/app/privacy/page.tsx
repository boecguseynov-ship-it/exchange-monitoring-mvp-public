import { AppShell } from "@/components/app-shell";
import { LegalDocument } from "@/components/legal-document";
import { legalPages } from "@/lib/legal-pages";

export const metadata = {
  title: "Политика конфиденциальности — RateScope"
};

export default function PrivacyPage() {
  return (
    <AppShell footer>
      <LegalDocument page={legalPages.privacy} />
    </AppShell>
  );
}
