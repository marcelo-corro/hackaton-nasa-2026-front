import { readFileSync } from "node:fs";
import type { Config } from "@react-router/dev/config";

// Sitio estático para GitHub Pages: sin servidor. BASE_PATH es la subcarpeta donde se publica
// (por ejemplo /hackaton-nasa-2026-front/beta/); en desarrollo es "/".
const base = process.env.BASE_PATH ?? "/";

// Se genera el HTML de cada página al compilar: GitHub Pages no tiene servidor que redirija las rutas a la app,
// y así cada comuna tiene su propia dirección (y título) que se puede compartir.
const comunas = JSON.parse(readFileSync(new URL("./app/lib/comunas-indice.json", import.meta.url), "utf8")) as {
  slug: string;
}[];

export default {
  ssr: false,
  basename: base,
  prerender: ["/", "/mapa", "/quienes-somos", ...comunas.map((c) => `/comuna/${c.slug}`)],
} satisfies Config;
