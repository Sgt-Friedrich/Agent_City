import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Agent City Visual Observability",
  description: "Architecture parsing and runtime flow visualization for agent systems",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
