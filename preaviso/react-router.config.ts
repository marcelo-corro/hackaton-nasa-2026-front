import type { Config } from "@react-router/dev/config";

// Sitio estático para GitHub Pages: sin servidor. BASE_PATH es la subcarpeta donde se publica
// (por ejemplo /hackaton-nasa-2026-front/beta/); en desarrollo es "/".
const base = process.env.BASE_PATH ?? "/";

export default {
  ssr: false,
  basename: base,
} satisfies Config;
