import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import ServiceWorker from "@/components/service-worker";

export const metadata: Metadata = {
  title: "Delivery List — offline cash memo converter",
  description:
    "Turn an Indane Cash Memo Bulk PDF into a clean A4 delivery list. Runs entirely in your browser. No uploads, no AI, no account.",
  applicationName: "Delivery List",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Delivery List — cash memo in, delivery list out",
    description:
      "An offline, browser-only converter for Indane cash memos. Names, addresses and payments stay on the device.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111a22",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-type="software" data-radius="soft">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
