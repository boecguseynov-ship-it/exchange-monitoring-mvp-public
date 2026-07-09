import { MonitoringPage } from "@/features/monitoring/monitor-page";

export const dynamic = "force-dynamic";

type DirectionPageProps = {
  params: Promise<{ direction: string }>;
};

export async function generateMetadata({ params }: DirectionPageProps) {
  const { direction } = await params;
  return {
    title: `${direction.replace(/\.html$/i, "").replace("-to-", " → ")} — monik exchange`
  };
}

export default async function DirectionPage({ params }: DirectionPageProps) {
  const { direction } = await params;
  return <MonitoringPage direction={direction} strictDirection />;
}
