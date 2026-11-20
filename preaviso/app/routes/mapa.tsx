import { ArrowRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Esqueleto, PuntoFuego } from "~/componentes/Basicos";
import { Encabezado } from "~/componentes/Encabezado";
import { comunaPorId, regionCorta } from "~/lib/comunas";
import { useActivos, useComunas, useRiesgo } from "~/lib/datos";
import type { Horizonte } from "~/lib/esquemas";
import { cn, COLOR_NIVEL, fecha, fechaBreve, HORIZONTES, NIVELES, porcentaje } from "~/lib/formato";
import type { Route } from "./+types/mapa";

const MapaChile = lazy(() => import("~/componentes/mapa/MapaChile"));

export const meta: Route.MetaFunction = () => [{ title: "Mapa de riesgo de incendio · Preaviso" }];

function useEscritorio() {
  const [es, setEs] = useState(true);
  useEffect(() => {
    const mq = matchMedia("(min-width: 768px)");
    const f = () => setEs(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return es;
}

export default function Mapa() {
  const [params, setParams] = useSearchParams();
  const [horizonte, setHorizonte] = useState<Horizonte>("24");
  const seleccion = params.get("comuna");
  const escritorio = useEscritorio();
  const { data: riesgo } = useRiesgo(horizonte);
  const { data: activos } = useActivos();
  const { data: comunas } = useComunas();

  const elegir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("comuna", id);
    else p.delete("comuna");
    setParams(p, { replace: true, preventScrollReset: true });
  };

  const prioridades = useMemo(() => {
    if (!riesgo) return [];
    return [...riesgo.items]
      .filter((i) => i.nivel !== "bajo")
      .sort((a, b) => b.prob_foco - a.prob_foco)
      .slice(0, 12);
  }, [riesgo]);

  const margen = escritorio
    ? { top: 72, bottom: 24, left: 340, right: seleccion ? 400 : 24 }
    : { top: 64, bottom: seleccion ? 260 : 24, left: 8, right: 8 };

  const sel = seleccion ? comunaPorId(seleccion) : undefined;
  const selRiesgo = riesgo?.items.find((i) => i.region_id === seleccion);
  const selDatos = comunas?.comunas.find((c) => c.region_id === seleccion);
  const selFuegos = activos?.incendios.filter((i) => i.region_id === seleccion) ?? [];

  return (
    <div className="flex h-dvh flex-col">
      <Encabezado />
      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={<Esqueleto className="size-full rounded-none" />}>
          <MapaChile horizonte={horizonte} seleccion={seleccion} onSeleccion={elegir} margen={margen} />
        </Suspense>

        {/* Horizonte */}
        <div className="absolute left-2 right-2 top-3 z-20 flex justify-center md:left-4 md:right-auto md:justify-start">
          <div className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie/90 p-1 pr-3 shadow-lg shadow-black/5 backdrop-blur-md">
            <div className="flex">
              {HORIZONTES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHorizonte(h.id)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
                    horizonte === h.id ? "bg-tinta text-fondo" : "text-tinta-suave hover:text-tinta",
                  )}
                >
                  {h.nombre}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-tinta-suave sm:inline">
              {riesgo
                ? riesgo.valido_hasta && riesgo.valido_hasta !== riesgo.valido_para
                  ? `${fechaBreve(riesgo.valido_para)} al ${fechaBreve(riesgo.valido_hasta)}`
                  : fecha(riesgo.valido_para)
                : ""}
            </span>
          </div>
        </div>

        {/* Prioridades (escritorio) */}
        {escritorio && (
          <aside className="absolute bottom-6 left-4 top-[4.5rem] z-20 flex w-80 flex-col overflow-hidden rounded-3xl border border-borde bg-superficie/92 shadow-xl shadow-black/5 backdrop-blur-md">
            <div className="border-b border-borde/70 p-4">
              <h2 className="text-[15px] font-semibold">Prioridades</h2>
              <p className="mt-1 flex items-center gap-2 text-xs text-tinta-suave">
                <PuntoFuego className="size-2" />
                {activos ? `${activos.incendios.length} incendios activos (3 días)` : "Cargando…"}
              </p>
            </div>
            <ol className="flex-1 overflow-y-auto p-2">
              {prioridades.map((i) => {
                const c = comunaPorId(i.region_id);
                if (!c) return null;
                return (
                  <li key={i.region_id}>
                    <button
                      type="button"
                      onClick={() => elegir(i.region_id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-superficie-2",
                        seleccion === i.region_id && "bg-superficie-2",
                      )}
                    >
                      <span className={cn("h-8 w-1 rounded-full", COLOR_NIVEL[i.nivel].punto)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.nombre}</span>
                        <span className="block truncate text-xs text-tinta-suave">{regionCorta(c.id)}</span>
                      </span>
                      <span className="cifra text-sm text-tinta-suave">{porcentaje(i.prob_foco)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Leyenda />
          </aside>
        )}

        {/* Comuna elegida */}
        <AnimatePresence>
          {sel && (
            <motion.aside
              key={sel.id}
              initial={escritorio ? { opacity: 0, x: 24 } : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={escritorio ? { opacity: 0, x: 24 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute z-30 overflow-y-auto border border-borde bg-superficie/95 shadow-2xl shadow-black/10 backdrop-blur-md",
                escritorio
                  ? "bottom-6 right-4 top-[4.5rem] w-[22rem] rounded-3xl p-5"
                  : "inset-x-0 bottom-0 max-h-[60%] rounded-t-3xl p-5 pb-8",
              )}
            >
              {!escritorio && <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-borde" />}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-tinta-suave">{sel.region}</p>
                  <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{sel.nombre}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => elegir(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-tinta-suave hover:bg-superficie-2"
                  aria-label="Cerrar"
                >
                  <X className="size-4" />
                </button>
              </div>

              {selRiesgo ? (
                <div className={cn("mt-4 rounded-2xl p-4", COLOR_NIVEL[selRiesgo.nivel].fondo, COLOR_NIVEL[selRiesgo.nivel].texto)}>
                  <p className="text-xs font-medium opacity-80">
                    {HORIZONTES.find((h) => h.id === horizonte)?.nombre}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{NIVELES[selRiesgo.nivel].nombre}</p>
                  <p className="cifra mt-1 text-sm opacity-90">{porcentaje(selRiesgo.prob_foco)} de probabilidad de foco</p>
                </div>
              ) : (
                <Esqueleto className="mt-4 h-24" />
              )}

              {selDatos && (
                <div className="mt-4 space-y-3 text-sm">
                  {selDatos.fuego_activo ? (
                    <p className="flex items-center gap-2 font-medium">
                      <PuntoFuego /> Focos en los últimos 3 días
                      {selFuegos.length > 0 && ` · ${selFuegos.length} ${selFuegos.length === 1 ? "incendio" : "incendios"}`}
                    </p>
                  ) : (
                    <p className="text-tinta-suave">Sin incendios detectados en los últimos 3 días.</p>
                  )}
                  <ul className="space-y-1.5 text-tinta-suave">
                    {selDatos.motivos.slice(0, 3).map((m) => (
                      <li key={m} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-tinta-tenue" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link
                to={`/comuna/${sel.slug}`}
                className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-tinta px-4 py-3 text-sm font-semibold text-fondo transition hover:opacity-90"
              >
                Ver ficha completa <ArrowRight className="size-4" />
              </Link>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Leyenda() {
  return (
    <div className="border-t border-borde/70 p-4 text-xs text-tinta-suave">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {(["bajo", "medio", "alto", "muy_alto"] as const).map((n) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", COLOR_NIVEL[n].punto)} />
            {NIVELES[n].corto}
          </span>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-fuego" /> Incendio activo; al acercar, zona probable de avance (~70 % y
        ~85 %)
      </p>
    </div>
  );
}
