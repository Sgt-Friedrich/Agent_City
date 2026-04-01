import { ReplayApp } from "@/components/replay/ReplayApp";

interface ReplayPageProps {
  params: {
    traceId: string;
  };
}

export default function ReplayPage({ params }: ReplayPageProps) {
  return <ReplayApp traceId={params.traceId} />;
}
