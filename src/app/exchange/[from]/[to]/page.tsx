import { MonitoringPage } from "@/features/monitoring/monitor-page";

export const dynamic = "force-dynamic";

type ExchangeDirectionPageProps = {
  params: Promise<{ from: string; to: string }>;
};

export async function generateMetadata({ params }: ExchangeDirectionPageProps) {
  const { from, to } = await params;
  return {
    title: `${from} → ${to} — monik exchange`
  };
}

export default async function ExchangeDirectionPage({ params }: ExchangeDirectionPageProps) {
  const { from, to } = await params;
  return <MonitoringPage direction={`${from}-to-${to}`} strictDirection />;
}
