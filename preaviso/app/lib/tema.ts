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
  try {
    localStorage.setItem("tema", t);
  } catch {
    /* sin almacenamiento: el cambio dura hasta recargar */
  }
}

/**
 * Tema vigente; se actualiza si cambia la clase de <html> (botón del encabezado). Al generar las páginas (sin
 * document) y durante la hidratación vale "claro", y después toma el real: así el HTML generado calza con el
 * primer render del navegador.
 */
export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(suscribir, actual, () => "claro" as Tema);
  return [tema, cambiar];
}

export const ESTILO_MAPA: Record<Tema, string> = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  oscuro: "https://tiles.openfreemap.org/styles/dark",
};
