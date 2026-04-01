import { ReplayApp } from "@/components/replay/ReplayApp";

interface ReplayPageProps {
  params: {
    traceId: string;
  };
  searchParams?: {
    target?: string;
  };
}

export default function ReplayPage({ params, searchParams }: ReplayPageProps) {
  return <ReplayApp traceId={params.traceId} target={searchParams?.target ?? "mock"} />;
}
