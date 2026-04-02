"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ReplayApp } from "@/components/replay/ReplayApp";

function ReplayPageInner() {
  const searchParams = useSearchParams();
  const traceId = searchParams.get("traceId") ?? "mock-trace-001";
  const target = searchParams.get("target") ?? "mock";
  const spanId = searchParams.get("spanId") ?? undefined;

  return <ReplayApp traceId={traceId} target={target} initialSpanId={spanId} />;
}

export default function ReplayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-transparent text-sm text-slate-300">
          loading replay...
        </main>
      }
    >
      <ReplayPageInner />
    </Suspense>
  );
}
