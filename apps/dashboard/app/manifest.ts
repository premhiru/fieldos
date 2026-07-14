import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FieldOS",
    short_name: "FieldOS",
    description: "AI Operating System for Field Operations",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f6",
    theme_color: "#181c20",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
