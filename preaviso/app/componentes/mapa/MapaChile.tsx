import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { comunaPorId } from "~/lib/comunas";
import { useActivos, useGeometrias, useRecomendaciones, useRiesgo, useSectores } from "~/lib/datos";
import type { Horizonte, Nivel } from "~/lib/esquemas";
import { cn, COLOR_NIVEL, fechaBreve, NIVELES, porcentaje } from "~/lib/formato";
import { ESTILO_MAPA, useTema } from "~/lib/tema";
import { CAJA_CHILE, capas, FUENTE_RELIEVE, geoIncendios, MUNDO, type PropsIncendio } from "./capas";
import { prepararMapa } from "./estilo";
import { agregarIconos } from "./iconos";

type Props = {
  horizonte: Horizonte;
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  /** Comuna cuyos sectores de 1 km se muestran (piloto de Valparaíso), o null. */
  sectoresDe: string | null;
  vista3d: boolean;
  /** Margen para no tapar la comuna con los paneles flotantes. */
  margen: { top: number; bottom: number; left: number; right: number };
};

type Hover =
  | { tipo: "comuna"; x: number; y: number; nombre: string; nivel?: Nivel; prob?: number }
  | { tipo: "incendio"; x: number; y: number; p: PropsIncendio }
  | { tipo: "sector"; x: number; y: number; percentil: number; grande: number | null; rasgos: string[] };

const CAPAS_INTERACTIVAS = ["incendios-pulso", "sectores-relleno", "sectores-3d", "comunas-relleno"];

export default function MapaChile({ horizonte, seleccion, onSeleccion, sectoresDe, vista3d, margen }: Props) {
  const [tema] = useTema();
  const oscuro = tema === "oscuro";
  const mapa = useRef<MapRef>(null);
  const hoverId = useRef<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // Las capas propias van bajo los nombres del mapa base, para que se lean las ciudades.
  const [antesDe, setAntesDe] = useState<string>();
  const [listo, setListo] = useState(false);
  const { data: geo } = useGeometrias();
  const { data: riesgo } = useRiesgo(horizonte);
  const { data: activos } = useActivos();
  const { data: sectores } = useSectores(sectoresDe);
  const { data: recs } = useRecomendaciones();
  const c = capas(tema);

  const comunas = useMemo(() => {
    if (!geo) return null;
    const porId = new globalThis.Map(riesgo?.items.map((i) => [i.region_id, i]));
    return {
      ...geo,
      features: geo.features.map((f) => {
        const r = porId.get(f.properties.region_id);
        return { ...f, properties: { ...f.properties, nivel: r?.nivel ?? null, prob: r?.prob_foco ?? null } };
      }),
    } as FeatureCollection;
  }, [geo, riesgo]);

  const fuegos = useMemo(() => geoIncendios(activos?.incendios ?? []), [activos]);

  // Solo en desarrollo: deja el mapa en window.__mapa para forzar cuadros (redraw) cuando la pestaña no anima.
  useEffect(() => {
    if (import.meta.env.DEV && mapa.current) (window as unknown as { __mapa?: unknown }).__mapa = mapa.current.getMap();
  });

  // Volar a la comuna elegida.
  useEffect(() => {
    const m = mapa.current;
    const ci = seleccion ? comunaPorId(seleccion) : null;
    if (!m || !ci) return;
    m.fitBounds(
      [
        [ci.caja[0], ci.caja[1]],
        [ci.caja[2], ci.caja[3]],
      ],
      {
        padding: { top: margen.top + 40, bottom: margen.bottom + 40, left: margen.left + 40, right: margen.right + 40 },
        maxZoom: 11,
        duration: 1400,
        pitch: vista3d ? 55 : 0,
      },
    );
  }, [seleccion, listo, margen.top, margen.bottom, margen.left, margen.right]);

  // Inclinar o enderezar al cambiar la vista 3D.
  useEffect(() => {
    mapa.current?.easeTo({ pitch: vista3d ? 55 : 0, bearing: vista3d ? -12 : 0, duration: 900 });
  }, [vista3d]);

  const marcarHover = (id: string | null) => {
    const m = mapa.current;
    if (!m) return;
    if (hoverId.current) m.setFeatureState({ source: "comunas", id: hoverId.current }, { hover: false });
    hoverId.current = id;
    if (id) m.setFeatureState({ source: "comunas", id }, { hover: true });
  };

  const alMover = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) {
      marcarHover(null);
      setHover(null);
      return;
    }
    const { x, y } = e.point;
    if (f.layer.id === "incendios-pulso") {
      marcarHover(null);
      setHover({ tipo: "incendio", x, y, p: f.properties as PropsIncendio });
    } else if (f.layer.id.startsWith("sectores")) {
      marcarHover(null);
      const p = f.properties as { percentil_en_comuna: number; prob_incendio_grande: number | null; rasgos: string };
      // MapLibre entrega las listas de propiedades como texto JSON.
      const rasgos = typeof p.rasgos === "string" ? (JSON.parse(p.rasgos) as string[]) : (p.rasgos as string[]);
      setHover({ tipo: "sector", x, y, percentil: p.percentil_en_comuna, grande: p.prob_incendio_grande, rasgos });
    } else {
      const p = f.properties as { region_id: string; nombre: string; nivel?: Nivel; prob?: number };
      if (hoverId.current !== p.region_id) marcarHover(p.region_id);
      setHover({ tipo: "comuna", x, y, nombre: p.nombre, nivel: p.nivel, prob: p.prob });
    }
  };

  return (
    <div className="relative size-full">
      <Map
        ref={mapa}
        key={tema}
        mapStyle={ESTILO_MAPA[tema]}
        initialViewState={{
          bounds: CAJA_CHILE,
          fitBoundsOptions: {
            padding: { top: margen.top + 16, bottom: margen.bottom + 16, left: margen.left + 16, right: margen.right + 16 },
          },
        }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={CAPAS_INTERACTIVAS}
        onMouseMove={alMover}
        onMouseLeave={() => {
          marcarHover(null);
          setHover(null);
        }}
        onClick={(e) => {
          const f = e.features?.find((x) => x.layer.id === "comunas-relleno");
          const id = (f?.properties as { region_id?: string } | undefined)?.region_id;
          if (id) onSeleccion(id);
          else if (!e.features?.length) onSeleccion(null);
        }}
        onLoad={(e) => {
          agregarIconos(e.target, oscuro);
          setAntesDe(prepararMapa(e.target));
          setListo(true);
        }}
        cursor={hover ? "pointer" : "grab"}
        attributionControl={{ compact: true }}
        dragRotate={vista3d}
        pitchWithRotate={vista3d}
        maxPitch={70}
        minZoom={2.5}
      >
        <NavigationControl position="bottom-right" showCompass={vista3d} visualizePitch />
        {/* El relieve se agrega después de cargar: sus teselas no deben retrasar la primera vista. */}
        {listo && (
          <Source id="relieve" {...FUENTE_RELIEVE}>
            <Layer {...c.relieve} beforeId={antesDe} />
          </Source>
        )}
        <Source id="mundo" type="geojson" data={MUNDO}>
          {listo && <Layer {...c.atenuar} beforeId={antesDe} />}
        </Source>
        {comunas && listo && (
          <Source id="comunas" type="geojson" data={comunas} promoteId="region_id">
            <Layer
              {...c.relleno}
              beforeId={antesDe}
              filter={["!=", ["get", "region_id"], sectores ? (sectoresDe ?? "") : ""]}
            />
            <Layer {...c.borde} beforeId={antesDe} />
            <Layer {...c.seleccion} filter={["==", ["get", "region_id"], seleccion ?? ""]} />
          </Source>
        )}
        {sectores && listo && (
          // Sin fragmentos: <Source> solo les pasa su id a los hijos directos.
          <Source id="sectores" type="geojson" data={sectores}>
            {vista3d && <Layer {...c.sectores3d} />}
            {!vista3d && <Layer {...c.sectores} beforeId={antesDe} />}
            {!vista3d && <Layer {...c.sectoresBorde} beforeId={antesDe} />}
          </Source>
        )}
        <Source id="zonas" type="geojson" data={fuegos.zonas}>
          {listo && <Layer {...c.zonas} />}
        </Source>
        <Source id="fuegos" type="geojson" data={fuegos.puntos}>
          {listo && <Layer {...c.flecha} />}
          {listo && <Layer {...c.pulso} />}
        </Source>
      </Map>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-borde bg-superficie/95 px-3 py-2 text-sm shadow-lg backdrop-blur"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.tipo === "comuna" && (
            <>
              <p className="font-medium">{hover.nombre}</p>
              {hover.nivel && hover.prob != null && (
                <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", COLOR_NIVEL[hover.nivel].texto)}>
                  <span className={cn("size-1.5 rounded-full", COLOR_NIVEL[hover.nivel].punto)} />
                  {NIVELES[hover.nivel].corto} · {porcentaje(hover.prob)}
                </p>
              )}
            </>
          )}
          {hover.tipo === "incendio" && (
            <>
              <p className="font-medium">Incendio activo en {hover.p.comuna}</p>
              <p className="mt-0.5 text-xs text-tinta-suave">
                Desde el {fechaBreve(hover.p.inicio)} · {hover.p.focos} {hover.p.focos === 1 ? "foco" : "focos"}
                {hover.p.flecha && " · viento fuerte: la flecha indica hacia dónde sopla"}
              </p>
            </>
          )}
          {hover.tipo === "sector" && (
            <>
              <p className="font-medium">Sector de 1 km · percentil {Math.round(hover.percentil)} en la comuna</p>
              {hover.grande != null && (
                <p className="mt-0.5 text-xs text-tinta-suave">
                  Si hay fuego aquí, {porcentaje(hover.grande)} de que sea parte de un incendio grande
                </p>
              )}
              {recs && hover.rasgos.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-tinta-suave">
                  {hover.rasgos.map((r) => (
                    <li key={r}>· {recs.rasgos[r] ?? r}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
