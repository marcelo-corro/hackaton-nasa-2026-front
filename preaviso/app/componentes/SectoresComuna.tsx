import { lazy, Suspense, useMemo, useState } from "react";
import { Esqueleto, Tarjeta, TituloSeccion } from "~/componentes/Basicos";
import { RAMPA_PERCENTIL } from "~/componentes/mapa/capas";
import { useEnCliente } from "~/lib/cliente";
import { type PropsSector, useManifest, useRecomendaciones, useSectores } from "~/lib/datos";
import { cn, fecha, porcentaje } from "~/lib/formato";

const MapaComuna = lazy(() => import("~/componentes/mapa/MapaComuna"));

/** Nombre corto de cada rasgo del sector (el texto completo viene en recomendaciones.json → rasgos). */
const RASGO_CORTO: Record<string, string> = {
  interfaz: "Casas junto a vegetación",
  pastizal: "Pastizal",
  bosque_matorral: "Bosque o matorral",
  pendiente: "Pendiente fuerte",
  historial: "Con fuego antes",
  fuente_persistente: "Fuente industrial",
};

const CUANTOS = 5;

type Props = { id: string; nombre: string; caja: [number, number, number, number] };

/**
 * Sectores de 1 km de una comuna del piloto (Región de Valparaíso): mapa coloreado por el orden del modelo B dentro de
 * la comuna y los sectores donde es más probable que caiga el fuego si lo hay. No es dónde empieza un incendio.
 */
export function SectoresComuna({ id, nombre, caja }: Props) {
  const enCliente = useEnCliente();
  const { data: sectores, error } = useSectores(id);
  const { data: manifest } = useManifest();
  const { data: recs } = useRecomendaciones();
  const [elegido, setElegido] = useState<string | null>(null);

  // Orden de todos los sectores por probabilidad de recibir el fuego (sin las fuentes industriales).
  const orden = useMemo(
    () =>
      (sectores?.features ?? [])
        .map((f) => f.properties)
        .filter((p) => p.prob_si_fuego_en_comuna !== null && !p.rasgos.includes("fuente_persistente"))
        .sort((a, b) => (b.prob_si_fuego_en_comuna ?? 0) - (a.prob_si_fuego_en_comuna ?? 0)),
    [sectores],
  );
  const primeros = orden.slice(0, CUANTOS);
  const elegidoProps = elegido ? sectores?.features.find((f) => f.properties.sector_id === elegido)?.properties : undefined;
  const elegidoAparte = elegidoProps && !primeros.some((p) => p.sector_id === elegido) ? elegidoProps : undefined;
  const alternar = (sid: string) => setElegido((e) => (e === sid ? null : sid));

  return (
    <Tarjeta>
      <TituloSeccion>Dónde revisar primero en {nombre}</TituloSeccion>
      <p className="-mt-2 mb-4 max-w-prose text-sm leading-relaxed text-tinta-suave">
        La comuna dividida en sectores de 1 km. El color muestra dónde es más probable que caiga el fuego si lo hay en la
        comuna, según la vegetación, las casas junto a ella, la pendiente, los caminos y los incendios anteriores de
        cada sector. No predice dónde empieza un incendio.
      </p>

      {error ? (
        <p className="text-sm text-tinta-suave">No pudimos cargar los sectores de la comuna.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="h-80 overflow-hidden rounded-2xl border border-borde/80 lg:h-[26rem]">
              {enCliente && sectores ? (
                <Suspense fallback={<Esqueleto className="h-full rounded-none" />}>
                  <MapaComuna id={id} caja={caja} sectores={sectores} elegido={elegido} onElegir={alternar} />
                </Suspense>
              ) : (
                <Esqueleto className="h-full rounded-none" />
              )}
            </div>
            <div className="mt-3 h-2 rounded-full" style={{ background: RAMPA_PERCENTIL }} aria-hidden />
            <div className="mt-1 flex justify-between text-xs text-tinta-tenue">
              <span>Menos probable</span>
              <span>Más probable</span>
            </div>
          </div>

          <div className="space-y-2 lg:col-span-2">
            {!sectores ? (
              Array.from({ length: 3 }, (_, i) => <Esqueleto key={i} className="h-24" />)
            ) : (
              <>
                {elegidoAparte && (
                  <FichaSector
                    p={elegidoAparte}
                    puesto={orden.findIndex((p) => p.sector_id === elegidoAparte.sector_id) + 1}
                    total={orden.length}
                    activo
                    textos={recs?.rasgos}
                    onClick={() => setElegido(null)}
                  />
                )}
                <ol className="space-y-2">
                  {primeros.map((p, i) => (
                    <li key={p.sector_id}>
                      <FichaSector
                        p={p}
                        puesto={i + 1}
                        total={orden.length}
                        activo={elegido === p.sector_id}
                        textos={recs?.rasgos}
                        onClick={() => alternar(p.sector_id)}
                      />
                    </li>
                  ))}
                </ol>
                <p className="px-1 text-xs text-tinta-tenue">
                  Toca un sector de la lista para verlo en el mapa, o uno del mapa para ver sus datos.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {manifest?.sectores?.modelo_b?.nota && (
        <p className="mt-4 text-xs leading-relaxed text-tinta-tenue">{manifest.sectores.modelo_b.nota}</p>
      )}
    </Tarjeta>
  );
}

function FichaSector({
  p,
  puesto,
  total,
  activo,
  textos,
  onClick,
}: {
  p: PropsSector;
  puesto: number;
  total: number;
  activo: boolean;
  textos?: Record<string, string>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "w-full rounded-2xl border p-3 text-left text-sm transition",
        activo ? "border-tinta-suave bg-superficie-2" : "border-borde/80 hover:border-tinta-tenue",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {puesto > 0 ? `${puesto}.º de ${total} sectores` : "Sector elegido"}
        </span>
        {p.prob_si_fuego_en_comuna !== null && (
          <span className="cifra shrink-0 font-semibold">{porcentaje(p.prob_si_fuego_en_comuna)}</span>
        )}
      </div>
      {p.prob_si_fuego_en_comuna !== null && (
        <p className="text-xs text-tinta-suave">de que caiga aquí si hay fuego en la comuna</p>
      )}
      {p.rasgos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.rasgos.map((r) => (
            <span
              key={r}
              title={textos?.[r]}
              className="rounded-full bg-superficie-2 px-2 py-0.5 text-[11px] text-tinta-suave ring-1 ring-borde/70"
            >
              {RASGO_CORTO[r] ?? r}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-tinta-tenue">
        {p.dias_con_fuego > 0
          ? `Fuego en ${p.dias_con_fuego} ${p.dias_con_fuego === 1 ? "día" : "días"} desde 2012` +
            (p.ultimo_fuego ? ` (el último, el ${fecha(p.ultimo_fuego)} de ${p.ultimo_fuego.slice(0, 4)})` : "")
          : "Sin fuego registrado desde 2012"}
        {p.prob_incendio_grande !== null &&
          `. Si se quema, ${porcentaje(p.prob_incendio_grande)} de que sea parte de un incendio grande`}
        .
      </p>
    </button>
  );
}
