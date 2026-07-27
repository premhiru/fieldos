import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  applicationName: "Caladrona",
  title: {
    default: "Caladrona",
    template: "%s | Caladrona"
  },
  description: "Operational intelligence for the physical world",
  icons: {
    apple: "/icon.svg?v=2",
    icon: [{ type: "image/svg+xml", url: "/icon.svg?v=2" }]
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#f6f4ee", media: "(prefers-color-scheme: light)" },
    { color: "#151713", media: "(prefers-color-scheme: dark)" }
  ]
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
