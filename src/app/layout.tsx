import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PickDynasty", template: "%s · PickDynasty" },
  description:
    "Set up, track, administer, and compete in pick'em leagues with friends — for every sport.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PickDynasty" },
};

export const viewport: Viewport = {
  themeColor: "#1b6ff5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
