import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  applicationName: "FieldOS",
  title: "FieldOS",
  description: "AI Operating System for Field Operations",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
