import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import "./globals.css";
import { getServerLocale } from "@/lib/i18n-server";
import { RecallSessionInitializer } from "@/components/memory/recall-session-initializer";
import { PwaServiceWorker } from "@/components/pwa-service-worker";

export const metadata: Metadata = {
  title: "SnapBrain",
  description: "An AI-organized memory layer for screenshots, images, notes, and PDFs.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SnapBrain",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale}>
      <body>
        <PwaServiceWorker />
        <RecallSessionInitializer />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
