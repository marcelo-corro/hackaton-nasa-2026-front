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
import { useActivos, useGeometrias, useRiesgo } from "~/lib/datos";
import type { Horizonte, Nivel } from "~/lib/esquemas";
import { cn, COLOR_NIVEL, NIVELES, porcentaje } from "~/lib/formato";
import { ESTILO_MAPA, useTema } from "~/lib/tema";
import { CAJA_CHILE, capas, geoIncendios, MUNDO } from "./capas";

type Props = {
  horizonte: Horizonte;
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  /** Margen para no tapar la comuna con los paneles flotantes. */
  margen: { top: number; bottom: number; left: number; right: number };
};

type Hover = { x: number; y: number; nombre: string; nivel?: Nivel; prob?: number };

export default function MapaChile({ horizonte, seleccion, onSeleccion, margen }: Props) {
  const [tema] = useTema();
  const mapa = useRef<MapRef>(null);
  const hoverId = useRef<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // Las comunas van bajo los nombres del mapa base, para que se lean las ciudades.
  const [antesDe, setAntesDe] = useState<string>();
  const { data: geo } = useGeometrias();
  const { data: riesgo } = useRiesgo(horizonte);
  const { data: activos } = useActivos();
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
  }, [comunas]);

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
      { padding: { top: margen.top + 40, bottom: margen.bottom + 40, left: margen.left + 40, right: margen.right + 40 }, maxZoom: 10.5, duration: 1200 },
    );
  }, [seleccion, margen.top, margen.bottom, margen.left, margen.right]);

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
    const p = f.properties as { region_id: string; nombre: string; nivel?: Nivel; prob?: number };
    if (hoverId.current !== p.region_id) marcarHover(p.region_id);
    setHover({ x: e.point.x, y: e.point.y, nombre: p.nombre, nivel: p.nivel, prob: p.prob });
  };

  return (
    <div className="relative size-full">
      <Map
        ref={mapa}
        key={tema}
        mapStyle={ESTILO_MAPA[tema]}
        initialViewState={{
          bounds: CAJA_CHILE,
          fitBoundsOptions: { padding: { top: margen.top + 16, bottom: margen.bottom + 16, left: margen.left + 16, right: margen.right + 16 } },
        }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["comunas-relleno"]}
        onMouseMove={alMover}
        onMouseLeave={() => {
          marcarHover(null);
          setHover(null);
        }}
        onClick={(e) => {
          const id = (e.features?.[0]?.properties as { region_id?: string } | undefined)?.region_id;
          onSeleccion(id ?? null);
        }}
        cursor={hover ? "pointer" : "grab"}
        onLoad={(e) => setAntesDe(e.target.getStyle().layers.find((l) => l.type === "symbol")?.id)}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        minZoom={2.5}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <Source id="mundo" type="geojson" data={MUNDO}>
          <Layer {...c.atenuar} beforeId={antesDe} />
        </Source>
        {comunas && (
          <Source id="comunas" type="geojson" data={comunas} promoteId="region_id">
            <Layer {...c.relleno} beforeId={antesDe} />
            <Layer {...c.borde} beforeId={antesDe} />
            <Layer {...c.seleccion} filter={["==", ["get", "region_id"], seleccion ?? ""]} />
          </Source>
        )}
        <Source id="zonas" type="geojson" data={fuegos.zonas}>
          <Layer {...c.zonas} />
        </Source>
        <Source id="fuegos" type="geojson" data={fuegos.puntos}>
          <Layer {...c.halo} />
          <Layer {...c.punto} />
        </Source>
      </Map>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-borde bg-superficie/95 px-3 py-2 text-sm shadow-lg backdrop-blur"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="font-medium">{hover.nombre}</p>
          {hover.nivel && hover.prob != null && (
            <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", COLOR_NIVEL[hover.nivel].texto)}>
              <span className={cn("size-1.5 rounded-full", COLOR_NIVEL[hover.nivel].punto)} />
              {NIVELES[hover.nivel].corto} · {porcentaje(hover.prob)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
