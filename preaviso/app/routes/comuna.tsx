import {
  ArrowLeft,
  Check,
  CloudOff,
  Droplets,
  ExternalLink,
  Info,
  Map as IconoMapa,
  Phone,
  Share2,
  Star,
  Thermometer,
  Wind,
} from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ChipNivel, Esqueleto, PiePagina, PuntoFuego, Tarjeta, TituloSeccion } from "~/componentes/Basicos";
import { Encabezado } from "~/componentes/Encabezado";
import { SectoresComuna } from "~/componentes/SectoresComuna";
import { useEnCliente } from "~/lib/cliente";
import { comunaPorSlug } from "~/lib/comunas";
import { useActivos, useComunas, useManifest, useRecomendaciones, useRiesgo } from "~/lib/datos";
import type { Horizonte } from "~/lib/esquemas";
import {
  cn,
  COLOR_NIVEL,
  cuandoConFecha,
  cuandoFrase,
  despues,
  fecha,
  fechaBreve,
  frenteALoNormal,
  HORIZONTES,
  mes,
  NIVELES,
  porcentaje,
} from "~/lib/formato";
import type { Route } from "./+types/comuna";

const MapaComuna = lazy(() => import("~/componentes/mapa/MapaComuna"));

export const meta: Route.MetaFunction = ({ params }) => {
  const c = comunaPorSlug(params.slug);
  if (!c) return [{ title: "Comuna no encontrada · Preaviso" }];
  const titulo = `${c.nombre} · Riesgo de incendio · Preaviso`;
  const descripcion = `Pronóstico de riesgo de incendio en ${c.nombre} (${c.region}) a 24 horas, 48 horas y 7 días, incendios activos detectados por satélite y qué hacer.`;
  return [
    { title: titulo },
    { name: "description", content: descripcion },
    { property: "og:title", content: titulo },
    { property: "og:description", content: descripcion },
    { property: "og:type", content: "website" },
  ];
};

// Qué dato del clima resalta cada condición que publica el back.
const CONDICION_DATO: Record<string, "tmax" | "hrmin" | "viento"> = {
  calor: "tmax",
  temp_sobre_30: "tmax",
  aire_seco: "hrmin",
  humedad_bajo_30: "hrmin",
  viento: "viento",
  viento_sobre_30: "viento",
};

export default function Comuna() {
  const { slug = "" } = useParams();
  const indice = comunaPorSlug(slug);
  const { data: comunas, isLoading, error } = useComunas();
  const { data: activos } = useActivos();
  const { data: recs } = useRecomendaciones();
  const { data: manifest } = useManifest();
  const { data: r7 } = useRiesgo("168");
  const [horizonteRec, setHorizonteRec] = useState<Horizonte>("24");
  const enCliente = useEnCliente();

  const datos = useMemo(() => comunas?.comunas.find((c) => c.region_id === indice?.id), [comunas, indice]);
  const incendios = useMemo(
    () => activos?.incendios.filter((i) => i.region_id === indice?.id) ?? [],
    [activos, indice],
  );

  if (!indice) {
    return (
      <>
        <Encabezado />
        <main className="mx-auto max-w-xl px-4 pt-24 text-center">
          <h1 className="text-2xl font-semibold">No encontramos esa comuna</h1>
          <p className="mt-2 text-tinta-suave">Búscala por su nombre en el buscador de arriba.</p>
        </main>
      </>
    );
  }

  const nivel24 = datos?.riesgo["24"]?.nivel;
  // Sectores de 1 km: solo las comunas del piloto (Región de Valparaíso).
  const conSectores = !!manifest?.sectores?.regiones.includes(indice.id);
  const desde = comunas?.valido_para;
  const destacados = new Set((datos?.clima_ultimo_dia?.condiciones ?? []).map((c) => CONDICION_DATO[c]));
  const listaRecs = datos?.recomendaciones[horizonteRec] ?? [];

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
          <ArrowLeft className="size-4" /> Inicio
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-tinta-suave">{indice.region}</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{indice.nombre}</h1>
          </div>
          <Acciones id={indice.id} nombre={indice.nombre} />
        </div>

        {error && (
          <Tarjeta className="mt-6 border-muyalto/40">
            <p className="font-medium">No pudimos cargar los datos del día.</p>
            <p className="mt-1 text-sm text-tinta-suave">Revisa tu conexión e intenta de nuevo en un rato.</p>
          </Tarjeta>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* Pronóstico a 24 h: la respuesta a "¿cómo está mi comuna?" */}
            {isLoading || !datos || !desde ? (
              <Esqueleto className="h-52 rounded-3xl" />
            ) : (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative overflow-hidden rounded-3xl p-6 sm:p-8",
                  COLOR_NIVEL[nivel24!].fondo,
                  COLOR_NIVEL[nivel24!].texto,
                )}
              >
                <p className="text-sm font-medium opacity-80">Pronóstico para {cuandoConFecha(desde)}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{NIVELES[nivel24!].nombre}</p>
                <p className="mt-3 max-w-md text-base opacity-90">
                  <span className="cifra font-semibold">{porcentaje(datos.riesgo["24"].prob_foco)}</span> de
                  probabilidad de que los satélites detecten al menos un foco de incendio en la comuna.
                </p>
                {datos.pct_dias_con_fuego_mes !== null && (
                  <p className="mt-2 max-w-md text-sm opacity-80">
                    En {mes(desde)} lo normal es{" "}
                    <span className="cifra font-semibold">{porcentaje(datos.pct_dias_con_fuego_mes / 100)}</span> (parte
                    de los días con focos en la comuna, 2012-2026): {cuandoFrase(desde)} está{" "}
                    <span className="font-semibold">
                      {frenteALoNormal(datos.riesgo["24"].prob_foco, datos.pct_dias_con_fuego_mes)}
                    </span>
                    .
                  </p>
                )}
                <Escala nivel={nivel24!} />
              </motion.section>
            )}

            {/* Pronóstico por horizonte, como el pronóstico del tiempo */}
            <div className="grid grid-cols-3 gap-3">
              {HORIZONTES.map((h) => {
                const r = datos?.riesgo[h.id];
                return (
                  <div key={h.id} className="rounded-2xl border border-borde/80 bg-superficie p-3 sm:p-4">
                    <p className="text-xs font-medium text-tinta-suave">{h.nombre}</p>
                    <p className="mt-0.5 line-clamp-2 min-h-10 text-sm leading-5 font-medium sm:min-h-0">
                      {desde ? h.titulo(desde) : " "}
                    </p>
                    {r ? (
                      <>
                        <ChipNivel nivel={r.nivel} className="mt-3" />
                        <p className="cifra mt-2 text-xl font-semibold">{porcentaje(r.prob_foco)}</p>
                      </>
                    ) : (
                      <Esqueleto className="mt-3 h-12" />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="px-1 text-xs leading-relaxed text-tinta-tenue">
              Cada plazo usa sus propios cortes de nivel: a 7 días las probabilidades siempre son más altas, no las
              compares con las de 24 h. {r7?.orientativo && r7.nota}
            </p>

            {/* Dónde dentro de la comuna (piloto de sectores) */}
            {conSectores && <SectoresComuna id={indice.id} nombre={indice.nombre} caja={indice.caja} />}

            {/* Incendios activos */}
            <Tarjeta>
              <TituloSeccion>Incendios activos</TituloSeccion>
              <p className="-mt-2 mb-4 text-xs text-tinta-tenue">
                Lo que los satélites ya detectaron en los últimos 3 días; no es un pronóstico.
              </p>
              {!datos ? (
                <Esqueleto className="h-14" />
              ) : datos.fuego_activo ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2.5 font-medium">
                    <PuntoFuego /> Hay focos detectados por satélite en la comuna en los últimos 3 días
                    {datos.ultimo_fuego && ` (el último, el ${fechaBreve(datos.ultimo_fuego)})`}.
                  </p>
                  {incendios.map((i) => (
                    <div key={i.id} className="rounded-2xl bg-superficie-2 p-4 text-sm">
                      <p className="font-medium">
                        Incendio desde el {fechaBreve(i.inicio)} · {i.focos_incendio}{" "}
                        {i.focos_incendio === 1 ? "foco" : "focos"}
                      </p>
                      <p className="mt-1 text-tinta-suave">
                        Zona probable de avance{" "}
                        {activos ? `para ${cuandoFrase(despues(activos.ultimo_dato, 1))}` : "al día siguiente"}: dentro
                        de{" "}
                        {i.radio_km_70.toLocaleString("es-CL", { maximumFractionDigits: 1 })} km (~70 % de las veces) y{" "}
                        {i.radio_km_85.toLocaleString("es-CL", { maximumFractionDigits: 1 })} km (~85 %).
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2.5 text-tinta-suave">
                  <Check className="size-4 text-bajo-fuerte" />
                  Sin incendios detectados en los últimos 3 días
                  {datos.ultimo_fuego && `; el último foco fue el ${fecha(datos.ultimo_fuego)}`}.
                </p>
              )}
            </Tarjeta>

            {/* Por qué */}
            <Tarjeta>
              <TituloSeccion>Por qué</TituloSeccion>
              {!datos ? (
                <Esqueleto className="h-24" />
              ) : (
                <>
                  <ul className="space-y-2">
                    {datos.motivos.map((m) => (
                      <li key={m} className="flex gap-2.5 text-[15px]">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-tinta-tenue" />
                        {m}
                      </li>
                    ))}
                  </ul>
                  {datos.clima_ultimo_dia && (
                    <>
                      <p className="mb-3 mt-6 text-xs font-medium text-tinta-suave">
                        Clima del {fecha(datos.clima_ultimo_dia.fecha_clima)} (último día con datos de NASA POWER)
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Dato
                          icono={Thermometer}
                          etiqueta="Temp. máxima"
                          valor={fmt(datos.clima_ultimo_dia.tmax, "°C")}
                          destacado={destacados.has("tmax")}
                        />
                        <Dato
                          icono={Droplets}
                          etiqueta="Humedad mínima"
                          valor={fmt(datos.clima_ultimo_dia.hrmin, "%")}
                          destacado={destacados.has("hrmin")}
                        />
                        <Dato
                          icono={Wind}
                          etiqueta="Viento máximo"
                          valor={fmt(datos.clima_ultimo_dia.viento_max_kmh, "km/h")}
                          destacado={destacados.has("viento")}
                        />
                        <Dato
                          icono={CloudOff}
                          etiqueta="Días sin lluvia"
                          valor={fmt(datos.clima_ultimo_dia.dias_sin_lluvia, "")}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </Tarjeta>

            {/* Qué hacer */}
            <Tarjeta>
              <TituloSeccion
                accion={
                  <div className="flex rounded-xl bg-superficie-2 p-0.5 text-xs font-medium">
                    {HORIZONTES.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHorizonteRec(h.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 transition",
                          horizonteRec === h.id ? "bg-superficie text-tinta shadow-sm" : "text-tinta-suave",
                        )}
                      >
                        {h.nombre}
                      </button>
                    ))}
                  </div>
                }
              >
                Qué hacer
              </TituloSeccion>
              {!datos || !recs ? (
                <Esqueleto className="h-24" />
              ) : listaRecs.length === 0 ? (
                <p className="text-[15px] text-tinta-suave">
                  Sin recomendaciones especiales para este clima y nivel. Igual mantén despejados los alrededores de tu
                  casa y avisa de inmediato si ves humo o fuego.
                </p>
              ) : (
                <ul className="space-y-3">
                  {listaRecs.map((codigo) => {
                    const r = recs.recomendaciones[codigo];
                    if (!r) return null;
                    const f = r.fuente ? recs.fuentes[r.fuente] : undefined;
                    return (
                      <li key={codigo} className="flex gap-3">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-borde">
                          <Check className="size-3 text-tinta-tenue" />
                        </span>
                        <div className="text-[15px]">
                          {r.texto}
                          {f && (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 flex items-center gap-1 text-xs text-tinta-tenue hover:text-marca"
                            >
                              {f.nombre} <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>
          </div>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-borde/80 bg-superficie">
              {/* En las comunas con sectores, el mapa va en la sección de sectores */}
              {!conSectores && (
                <div className="h-72 lg:h-80">
                  {enCliente ? (
                    <Suspense fallback={<Esqueleto className="h-full rounded-none" />}>
                      <MapaComuna id={indice.id} caja={indice.caja} nivel={nivel24} />
                    </Suspense>
                  ) : (
                    <Esqueleto className="h-full rounded-none" />
                  )}
                </div>
              )}
              <Link
                to={`/mapa?comuna=${indice.id}`}
                className="flex items-center justify-between px-5 py-3.5 text-sm font-medium text-marca hover:underline"
              >
                <span className="flex items-center gap-2">
                  <IconoMapa className="size-4" /> Ver en el mapa de Chile
                </span>
                <span aria-hidden>→</span>
              </Link>
            </div>

            <Tarjeta className="bg-muyalto-suave/60">
              <p className="flex items-center gap-2 text-sm font-semibold text-muyalto-fuerte">
                <Phone className="size-4" /> Si ves humo o fuego, avisa de inmediato
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["130", "CONAF"],
                  ["132", "Bomberos"],
                  ["133", "Carabineros"],
                ].map(([n, quien]) => (
                  <a
                    key={n}
                    href={`tel:${n}`}
                    className="rounded-2xl bg-superficie px-2 py-2.5 transition hover:ring-2 hover:ring-muyalto/30"
                  >
                    <span className="cifra block text-xl font-semibold">{n}</span>
                    <span className="block text-xs text-tinta-suave">{quien}</span>
                  </a>
                ))}
              </div>
            </Tarjeta>

            <details className="group rounded-3xl border border-borde/80 bg-superficie p-5 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                <Info className="size-4 text-tinta-suave" /> Sobre estos datos
              </summary>
              <p className="mt-3 leading-relaxed text-tinta-suave">{manifest?.datos?.nota}</p>
              {comunas && <p className="mt-3 leading-relaxed text-tinta-tenue">{comunas.nota}</p>}
            </details>
          </aside>
        </div>
      </main>
      <PiePagina />
    </>
  );
}

const fmt = (v: number | null, u: string) =>
  v === null ? "—" : `${v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}${u ? ` ${u}` : ""}`;

function Dato({
  icono: Icono,
  etiqueta,
  valor,
  destacado,
}: {
  icono: typeof Wind;
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl p-3", destacado ? "bg-alto-suave text-alto-fuerte" : "bg-superficie-2")}>
      <Icono className={cn("size-4", destacado ? "" : "text-tinta-tenue")} />
      <p className="cifra mt-2 text-xl font-semibold">{valor}</p>
      <p className={cn("text-xs", destacado ? "opacity-80" : "text-tinta-suave")}>
        {etiqueta}
        {destacado && " · alta para la época"}
      </p>
    </div>
  );
}

function Escala({ nivel }: { nivel: keyof typeof NIVELES }) {
  const orden = NIVELES[nivel].orden;
  return (
    <div className="mt-6 flex gap-1.5" aria-hidden>
      {(["bajo", "medio", "alto", "muy_alto"] as const).map((n, i) => (
        <div key={n} className="flex-1">
          <div className={cn("h-1.5 rounded-full", COLOR_NIVEL[n].punto, i !== orden && "opacity-25")} />
          <p className={cn("mt-1.5 text-[11px]", i === orden ? "font-semibold" : "opacity-60")}>{NIVELES[n].corto}</p>
        </div>
      ))}
    </div>
  );
}

function Acciones({ id, nombre }: { id: string; nombre: string }) {
  const [sigue, setSigue] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    try {
      setSigue((JSON.parse(localStorage.getItem("sigo") ?? "[]") as string[]).includes(id));
    } catch {
      /* sin almacenamiento */
    }
  }, [id]);

  const alternar = () => {
    try {
      const lista = new Set(JSON.parse(localStorage.getItem("sigo") ?? "[]") as string[]);
      if (lista.has(id)) lista.delete(id);
      else lista.add(id);
      localStorage.setItem("sigo", JSON.stringify([...lista]));
      setSigue(lista.has(id));
    } catch {
      setSigue(!sigue);
    }
  };

  const compartir = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${nombre} · Preaviso`, url });
        return;
      } catch {
        /* cancelado: se copia el enlace */
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  const boton =
    "flex items-center gap-2 rounded-xl border border-borde bg-superficie px-3.5 py-2 text-sm font-medium transition hover:border-tinta-tenue";
  return (
    <div className="flex gap-2">
      <button type="button" onClick={alternar} className={boton} aria-pressed={sigue}>
        <Star className={cn("size-4", sigue && "fill-medio text-medio")} />
        {sigue ? "Siguiendo" : "Seguir"}
      </button>
      <button type="button" onClick={compartir} className={boton}>
        {copiado ? <Check className="size-4" /> : <Share2 className="size-4" />}
        {copiado ? "Enlace copiado" : "Compartir"}
      </button>
    </div>
  );
}
