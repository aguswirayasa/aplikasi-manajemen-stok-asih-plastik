import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asih Plastik Stok Manager",
    short_name: "Asih Stok",
    description: "Sistem manajemen stok multivariasi.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fffefb",
    theme_color: "#ff4f00",
    icons: [
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
