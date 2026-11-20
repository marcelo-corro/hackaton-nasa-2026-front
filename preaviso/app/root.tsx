import "@fontsource-variable/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

// Se aplica antes de pintar para que no parpadee: oscuro por defecto, claro solo si el usuario lo eligió con el botón
// del encabezado (queda guardado). También ajusta el color de la barra del navegador en el celular.
const TEMA_INICIAL = `try{if(localStorage.getItem("tema")==="claro")document.querySelector('meta[name="theme-color"]').content="#f5f4f0";else document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`;

export const meta: Route.MetaFunction = () => [
  { title: "Preaviso · Riesgo de incendio en tu comuna" },
  {
    name: "description",
    content:
      "Probabilidad de incendio en las 345 comunas de Chile para mañana, 48 horas y 7 días, con incendios activos detectados por satélite.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0e1012" suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-fondo font-sans text-tinta antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={cliente}>
      <Outlet />
    </QueryClientProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="grid min-h-dvh place-items-center text-tinta-suave">
      <span className="animate-pulse">Cargando Preaviso…</span>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let titulo = "Algo salió mal";
  let detalle = "Ocurrió un error inesperado. Intenta recargar la página.";
  if (isRouteErrorResponse(error) && error.status === 404) {
    titulo = "Página no encontrada";
    detalle = "Revisa la dirección o busca tu comuna desde el inicio.";
  } else if (import.meta.env.DEV && error instanceof Error) {
    detalle = error.message;
  }
  return (
    <main className="mx-auto max-w-xl px-4 pt-24">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-tinta-suave">{detalle}</p>
      <a href={import.meta.env.BASE_URL} className="mt-6 inline-block font-medium text-marca underline">
        Ir al inicio
      </a>
    </main>
  );
}
