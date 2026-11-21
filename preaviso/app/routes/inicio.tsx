import { ArrowRight, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router";
import { ChipNivel, Esqueleto, PiePagina, PuntoFuego, Tarjeta, TituloSeccion } from "~/componentes/Basicos";
import { Buscador } from "~/componentes/Buscador";
import { Encabezado } from "~/componentes/Encabezado";
import { comunaPorId, comunaPorSlug, REGION_CORTA, regionCorta } from "~/lib/comunas";
import { useActivos, useComunas, useRiesgo } from "~/lib/datos";
import { COLOR_NIVEL, cuandoConFecha, cuandoFrase, diasDesdeHoy, fecha, mes, porcentaje } from "~/lib/formato";

const EJEMPLOS = ["valparaiso", "quilpue", "temuco", "concepcion", "santiago"];

export default function Inicio() {
  const { data: riesgo, isLoading } = useRiesgo("24");
  const { data: activos } = useActivos();
  const { data: comunas } = useComunas();

  // Lo normal de cada comuna en el mes: parte de los días con focos (2012-2026), en %.
  const normal = useMemo(
    () => new Map(comunas?.comunas.map((c) => [c.region_id, c.pct_dias_con_fuego_mes] as const) ?? []),
    [comunas],
  );

  const resumen = useMemo(() => {
    if (!riesgo) return null;
    const items = [...riesgo.items].sort((a, b) => b.prob_foco - a.prob_foco);
    return {
      altos: items.filter((i) => i.nivel === "alto" || i.nivel === "muy_alto").length,
      medios: items.filter((i) => i.nivel === "medio").length,
      top: items.slice(0, 8),
    };
  }, [riesgo]);

  const fuegosPorRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of activos?.incendios ?? []) m.set(i.region_id.slice(0, 2), (m.get(i.region_id.slice(0, 2)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [activos]);
  const maxFuegos = fuegosPorRegion[0]?.[1] ?? 1;

  return (
    <>
      <Encabezado conBuscador={false} />
      <main className="mx-auto max-w-6xl px-4">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl pb-10 pt-14 text-center sm:pt-20"
        >
          <p className="text-sm font-medium text-tinta-suave">
            {riesgo ? `Pronóstico para ${cuandoConFecha(riesgo.valido_para)}` : " "}
          </p>
          {riesgo && diasDesdeHoy(riesgo.valido_para) < 0 && (
            <p className="mx-auto mt-3 w-fit rounded-full bg-medio-suave px-3 py-1 text-xs font-medium text-medio-fuerte">
              Todavía no hay pronóstico para hoy: se muestra el último publicado.
            </p>
          )}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            ¿Cómo está tu comuna?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-tinta-suave sm:text-lg">
            El pronóstico de riesgo de incendio de las 345 comunas de Chile para hoy y los próximos días, y los
            incendios que los satélites ya están detectando.
          </p>
          <div className="mt-8 text-left">
            <Buscador autoFocus />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
            {EJEMPLOS.map((s) => (
              <Link
                key={s}
                to={`/comuna/${s}`}
                className="rounded-full border border-borde bg-superficie px-3 py-1 text-tinta-suave transition hover:border-marca hover:text-tinta"
              >
                {comunaPorSlug(s)?.nombre ?? s}
              </Link>
            ))}
          </div>
        </motion.section>

        <div className="grid gap-x-4 gap-y-10 lg:grid-cols-5">
          {/* Pronóstico: lo que calcula el modelo para hoy y los próximos días */}
          <section className="space-y-4 lg:col-span-3" aria-labelledby="titulo-pronostico">
            <Bloque id="titulo-pronostico" titulo="Pronóstico" marca={<MarcaNiveles />}>
              Probabilidad de que los satélites detecten al menos un foco de incendio en cada comuna. La calcula un
              modelo con los focos de los días previos, la historia de la comuna en esta época del año y el clima.
            </Bloque>
            <div className="grid grid-cols-2 gap-4">
              <Cifra
                titulo="Comunas en riesgo alto o muy alto"
                valor={resumen?.altos}
                detalle={riesgo ? `para ${cuandoConFecha(riesgo.valido_para)}` : ""}
                tono="text-alto-fuerte"
              />
              <Cifra
                titulo="Comunas en riesgo medio"
                valor={resumen?.medios}
                detalle="de 345 comunas"
                tono="text-medio-fuerte"
              />
            </div>
            <Tarjeta>
              <TituloSeccion
                accion={
                  <Link to="/mapa" className="flex items-center gap-1 text-sm font-medium text-marca hover:underline">
                    Ver en el mapa <ArrowRight className="size-4" />
                  </Link>
                }
              >
                {riesgo ? `Dónde está el riesgo ${cuandoFrase(riesgo.valido_para)}` : "Dónde está el riesgo"}
              </TituloSeccion>
              {isLoading || !resumen ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Esqueleto key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <ol className="-mx-2">
                  {resumen.top.map((i, n) => {
                    const c = comunaPorId(i.region_id);
                    if (!c) return null;
                    const n0 = normal.get(i.region_id);
                    return (
                      <li key={i.region_id}>
                        <Link
                          to={`/comuna/${c.slug}`}
                          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-superficie-2"
                        >
                          <span className="cifra w-5 text-right text-sm text-tinta-tenue">{n + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{c.nombre}</span>
                            <span className="block truncate text-xs text-tinta-suave">{regionCorta(c.id)}</span>
                          </span>
                          <span className="text-right">
                            <span className="cifra block text-sm font-medium tabular-nums">{porcentaje(i.prob_foco)}</span>
                            <span className="cifra block text-[11px] tabular-nums text-tinta-tenue">
                              {n0 === undefined || n0 === null ? " " : `normal ${porcentaje(n0 / 100)}`}
                            </span>
                          </span>
                          <ChipNivel nivel={i.nivel} className="w-[4.6rem] justify-center" />
                          <ChevronRight className="size-4 text-tinta-tenue transition group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {riesgo && (
                <p className="mt-4 text-xs leading-relaxed text-tinta-tenue">
                  «Normal» es la parte de los días de {mes(riesgo.valido_para)} en que hubo focos en esa comuna
                  (2012-2026). Un 15 % puede ser «alto» en una comuna donde casi nunca hay focos y lo de siempre en otra
                  que los tiene seguido.
                </p>
              )}
            </Tarjeta>
          </section>

          {/* Incendios activos: lo que ya detectaron los satélites (no es pronóstico) */}
          <section className="space-y-4 lg:col-span-2" aria-labelledby="titulo-activos">
            <Bloque id="titulo-activos" titulo="Incendios activos" marca={<PuntoFuego />}>
              Lo que los satélites ya detectaron en los últimos 3 días. No es un pronóstico.
            </Bloque>
            <Cifra
              titulo="Incendios en Chile"
              valor={activos?.incendios.length}
              detalle={activos ? `detectados en los 3 días hasta el ${fecha(activos.ultimo_dato)}` : ""}
              tono="text-fuego"
              fuego
            />
            <Tarjeta>
              <TituloSeccion>Por región</TituloSeccion>
              {!activos ? (
                <Esqueleto className="h-40" />
              ) : fuegosPorRegion.length === 0 ? (
                <p className="text-sm text-tinta-suave">No hay incendios detectados en los últimos 3 días.</p>
              ) : (
                <ul className="space-y-3">
                  {fuegosPorRegion.map(([cod, n]) => (
                    <li key={cod} className="text-sm">
                      <div className="mb-1 flex justify-between">
                        <span>{REGION_CORTA[cod]}</span>
                        <span className="cifra font-medium">{n}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
                        <motion.div
                          className="h-full rounded-full bg-fuego"
                          initial={{ width: 0 }}
                          animate={{ width: `${(n / maxFuegos) * 100}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {activos && (
                <p className="mt-5 text-xs leading-relaxed text-tinta-tenue">
                  Focos satelitales VIIRS hasta el {fecha(activos.ultimo_dato)}. Fuera de la Región de Valparaíso pueden
                  incluir alguna fuente industrial que FIRMS no marca.
                </p>
              )}
            </Tarjeta>
          </section>
        </div>
      </main>
      <PiePagina />
    </>
  );
}

/** Encabezado de cada bloque del inicio: qué es y de dónde sale. */
function Bloque({
  id,
  titulo,
  marca,
  children,
}: {
  id: string;
  titulo: string;
  marca: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-1">
      <h2 id={id} className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
        {marca}
        {titulo}
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-tinta-suave">{children}</p>
    </div>
  );
}

/** Los cuatro colores de nivel, como marca del bloque del pronóstico. */
function MarcaNiveles() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {(["bajo", "medio", "alto", "muy_alto"] as const).map((n) => (
        <span key={n} className={`h-3.5 w-1.5 rounded-full ${COLOR_NIVEL[n].punto}`} />
      ))}
    </span>
  );
}

function Cifra({
  titulo,
  valor,
  detalle,
  tono,
  fuego,
}: {
  titulo: string;
  valor?: number;
  detalle: string;
  tono: string;
  fuego?: boolean;
}) {
  return (
    <Tarjeta>
      <p className="flex items-center gap-2 text-sm text-tinta-suave">
        {fuego && <PuntoFuego />}
        {titulo}
      </p>
      {valor === undefined ? (
        <Esqueleto className="mt-3 h-10 w-20" />
      ) : (
        <p className={`cifra mt-2 text-5xl font-semibold ${tono}`}>{valor}</p>
      )}
      <p className="mt-2 text-xs text-tinta-tenue">{detalle}</p>
    </Tarjeta>
  );
}
