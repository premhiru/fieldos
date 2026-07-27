import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caladrona",
    short_name: "Caladrona",
    description: "Operational intelligence for the physical world",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#0f9d86",
    icons: [
      {
        src: "/icon.svg?v=2",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
