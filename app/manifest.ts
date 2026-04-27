import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stock Management",
    short_name: "Stock",
    description: "Sistem manajemen stok multivariasi.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fffefb",
    theme_color: "#ff4f00",
    icons: [
      {
        src: "/icons/stock-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/stock-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
