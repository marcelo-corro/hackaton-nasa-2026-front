import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: { port: 5180, strictPort: true },
  // MapLibre 6 calcula la ruta de su worker relativa a su propio archivo: si Vite lo pre-empaqueta en desarrollo,
  // esa ruta se rompe ("Worker failed to load"). Al compilar, la URL se fija en app/componentes/mapa/maplibre.ts.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
