import { Suspense } from "react";

import { DashboardApp } from "@/components/DashboardApp";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center text-sm text-slate-300">
          Loading dashboard...
        </main>
      }
    >
      <DashboardApp />
    </Suspense>
  );
}
