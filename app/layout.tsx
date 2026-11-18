import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import ServiceWorker from "@/components/service-worker";

// On Vercel this resolves to the project's production domain; set
// NEXT_PUBLIC_SITE_URL to override it for another host.
const vercelHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Delivery List — offline cash memo converter",
  description:
    "Turn an Indane Cash Memo Bulk PDF into a clean A4 delivery list. Runs entirely in your browser. No uploads, no AI, no account.",
  applicationName: "Delivery List",
  authors: [{ name: "Dhiraj Arya", url: "https://github.com/dhirajaryaa" }],
  creator: "Dhiraj Arya",
  publisher: "Dhiraj Arya",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Delivery List",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Delivery List — cash memo in, delivery list out",
    description:
      "An offline, browser-only converter for Indane cash memos. Names, addresses and payments stay on the device.",
    type: "website",
    url: "/",
    siteName: "Delivery List",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Cash memo in. Delivery list out. Offline Indane cash memo converter.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Delivery List — cash memo in, delivery list out",
    description:
      "Turn an Indane Cash Memo Bulk PDF into a clean A4 delivery list in the browser. No uploads, no AI.",
    images: ["/og.png"],
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
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
