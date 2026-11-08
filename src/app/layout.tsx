import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kasa Trading | Espace commercial",
  description: "Gérez simplement vos clients, votre catalogue et vos commandes Kasa Trading.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body suppressHydrationWarning>{children}</body></html>;
}
