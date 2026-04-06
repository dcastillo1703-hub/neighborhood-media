import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neighborhood Media OS",
    short_name: "NMOS",
    description: "Restaurant growth operating system for campaigns, content, approvals, publishing, and performance.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe4",
    theme_color: "#f5efe4",
    orientation: "portrait",
    icons: [
      {
        src: "/app-icon.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/app-icon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
