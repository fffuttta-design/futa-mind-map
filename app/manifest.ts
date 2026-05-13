import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FutaMindMap",
    short_name: "FutaMindMap",
    description: "あなたのマインドマップツール",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#6366f1",
    icons: [
      {
        src: "/api/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
