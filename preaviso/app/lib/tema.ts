import { useSyncExternalStore } from "react";

export type Tema = "claro" | "oscuro";

const actual = (): Tema => (document.documentElement.classList.contains("dark") ? "oscuro" : "claro");

function suscribir(avisar: () => void) {
  const obs = new MutationObserver(avisar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function cambiar(t: Tema) {
  document.documentElement.classList.toggle("dark", t === "oscuro");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR_BARRA[t]);
  try {
    localStorage.setItem("tema", t);
  } catch {
    /* sin almacenamiento: el cambio dura hasta recargar */
  }
}

/** Color de la barra del navegador en el celular (meta theme-color) para cada tema: el fondo de la página. */
const COLOR_BARRA: Record<Tema, string> = { claro: "#f5f4f0", oscuro: "#0e1012" };

/**
 * Tema vigente; se actualiza si cambia la clase de <html> (botón del encabezado). El oscuro es el predeterminado
 * (root.tsx). Al generar las páginas (sin document) y durante la hidratación vale "oscuro", y después toma el real:
 * así el HTML generado calza con el primer render del navegador.
 */
export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(suscribir, actual, () => "oscuro" as Tema);
  return [tema, cambiar];
}

export const ESTILO_MAPA: Record<Tema, string> = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  oscuro: "https://tiles.openfreemap.org/styles/dark",
};
