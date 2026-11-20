import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/inicio.tsx"),
  route("comuna/:slug", "routes/comuna.tsx"),
  route("mapa", "routes/mapa.tsx"),
] satisfies RouteConfig;
