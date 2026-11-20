import { useEffect, useState } from "react";

export type Tema = "claro" | "oscuro";

const actual = (): Tema =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "oscuro" : "claro";

/** Tema vigente; se actualiza si cambia la clase de <html> (botón del encabezado). */
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(actual);
  useEffect(() => {
    const obs = new MutationObserver(() => setTema(actual()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const cambiar = (t: Tema) => {
    document.documentElement.classList.toggle("dark", t === "oscuro");
    try {
      localStorage.setItem("tema", t);
    } catch {
      /* sin almacenamiento: el cambio dura hasta recargar */
    }
  };
  return [tema, cambiar];
}

export const ESTILO_MAPA: Record<Tema, string> = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  oscuro: "https://tiles.openfreemap.org/styles/dark",
};
