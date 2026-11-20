import { Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { buscarComunas, regionCorta } from "~/lib/comunas";
import { useRiesgo } from "~/lib/datos";
import { cn, COLOR_NIVEL, NIVELES } from "~/lib/formato";

type Props = {
  compacto?: boolean;
  autoFocus?: boolean;
  /** Si se pasa, elegir una comuna llama a esta función en vez de abrir su ficha (por ejemplo, en el mapa). */
  alElegir?: (id: string) => void;
};

export function Buscador({ compacto = false, autoFocus = false, alElegir }: Props) {
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const navegar = useNavigate();
  const idLista = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const { data: riesgo } = useRiesgo("24");

  const nivelPorId = useMemo(() => new Map(riesgo?.items.map((i) => [i.region_id, i.nivel])), [riesgo]);
  const resultados = useMemo(() => buscarComunas(texto), [texto]);

  const ir = (slug: string) => {
    setTexto("");
    setAbierto(false);
    entrada.current?.blur();
    const c = resultados.find((r) => r.slug === slug);
    if (alElegir && c) alElegir(c.id);
    else navegar(`/comuna/${slug}`);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!resultados.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (a + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a - 1 + resultados.length) % resultados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(resultados[activo].slug);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrar = abierto && resultados.length > 0;

  return (
    <div className="relative">
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border border-borde bg-superficie text-tinta shadow-sm transition focus-within:border-marca focus-within:ring-4 focus-within:ring-marca/15",
          compacto ? "h-9 rounded-xl px-3" : "h-14 px-4 sm:h-16 sm:px-5",
        )}
      >
        <Search className={cn("shrink-0 text-tinta-tenue", compacto ? "size-4" : "size-5")} aria-hidden />
        <span className="sr-only">Busca tu comuna</span>
        <input
          ref={entrada}
          type="search"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={idLista}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={compacto ? "Busca tu comuna" : "Escribe tu comuna, por ejemplo Quilpué"}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          onKeyDown={teclas}
          className={cn(
            "w-full bg-transparent outline-none placeholder:text-tinta-tenue [&::-webkit-search-cancel-button]:hidden",
            compacto ? "text-sm" : "text-base sm:text-lg",
          )}
        />
      </label>

      {mostrar && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-borde bg-superficie p-1.5 shadow-xl shadow-black/5"
        >
          {resultados.map((c, i) => {
            const nivel = nivelPorId.get(c.id);
            return (
              <li key={c.id} role="option" aria-selected={i === activo}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => ir(c.slug)}
                  onMouseEnter={() => setActivo(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                    i === activo && "bg-superficie-2",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.nombre}</span>
                    <span className="block truncate text-xs text-tinta-suave">{regionCorta(c.id)}</span>
                  </span>
                  {nivel && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        COLOR_NIVEL[nivel].fondo,
                        COLOR_NIVEL[nivel].texto,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", COLOR_NIVEL[nivel].punto)} />
                      {NIVELES[nivel].corto}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
