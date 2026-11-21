import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { type PropsSector, useActivos, useGeometrias } from "~/lib/datos";
import type { Nivel } from "~/lib/esquemas";
import { ESTILO_MAPA, useTema } from "~/lib/tema";
import { capas, FUENTE_RELIEVE, geoIncendios, MUNDO } from "./capas";
import { prepararMapa } from "./estilo";
import { agregarIconos } from "./iconos";

type Props = {
  id: string;
  caja: [number, number, number, number];
  nivel?: Nivel;
  /** Sectores de 1 km de la comuna (piloto de Valparaíso): se pintan por su orden dentro de la comuna. */
  sectores?: FeatureCollection<Polygon | MultiPolygon, PropsSector>;
  /** Sector destacado (se marca y el mapa se acerca a él). */
  elegido?: string | null;
  onElegir?: (sectorId: string) => void;
};

/**
 * Mapa de la ficha: la comuna con el color de su nivel, el relieve e incendios activos cercanos. Con `sectores`, en
 * vez del color del nivel muestra los sectores de 1 km (clic para elegir uno).
 */
export default function MapaComuna({ id, caja, nivel, sectores, elegido, onElegir }: Props) {
  const [tema] = useTema();
  const { data: geo } = useGeometrias();
  const { data: activos } = useActivos();
  const c = capas(tema);
  const mapa = useRef<MapRef>(null);
  const [antesDe, setAntesDe] = useState<string>();
  const [listo, setListo] = useState(false);
  const [sobreSector, setSobreSector] = useState(false);

  const comuna = useMemo(() => {
    const f = geo?.features.find((x) => x.properties.region_id === id);
    return f ? { ...f, properties: { ...f.properties, nivel } } : null;
  }, [geo, id, nivel]);
  const fuegos = useMemo(() => geoIncendios(activos?.incendios ?? []), [activos]);

  // Al elegir un sector (en la lista o en el mapa), acercarse a él; al quitarlo, volver a la comuna.
  const previo = useRef<string | null>(null);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo || previo.current === (elegido ?? null)) return;
    previo.current = elegido ?? null;
    const s = elegido ? sectores?.features.find((f) => f.properties.sector_id === elegido) : undefined;
    if (s) m.flyTo({ center: [s.properties.lon, s.properties.lat], zoom: Math.max(m.getZoom(), 12.5), duration: 900 });
    else m.fitBounds([caja[0], caja[1], caja[2], caja[3]], { padding: 28, duration: 700 });
  }, [elegido, sectores, listo, caja]);

  const alClic = (e: MapLayerMouseEvent) => {
    const sid = (e.features?.[0]?.properties as { sector_id?: string } | undefined)?.sector_id;
    if (sid && onElegir) onElegir(sid);
  };

  return (
    <Map
      key={tema}
      ref={mapa}
      mapStyle={ESTILO_MAPA[tema]}
      initialViewState={{ bounds: [caja[0], caja[1], caja[2], caja[3]], fitBoundsOptions: { padding: 28 } }}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      cooperativeGestures
      dragRotate={false}
      pitchWithRotate={false}
      interactiveLayerIds={sectores ? ["sectores-relleno"] : []}
      cursor={sobreSector ? "pointer" : undefined}
      onMouseMove={(e) => setSobreSector(!!e.features?.length)}
      onMouseLeave={() => setSobreSector(false)}
      onClick={sectores ? alClic : undefined}
      onLoad={(e) => {
        agregarIconos(e.target, tema === "oscuro");
        setAntesDe(prepararMapa(e.target));
        setListo(true);
      }}
    >
      {listo && (
        <Source id="relieve" {...FUENTE_RELIEVE}>
          <Layer {...c.relieve} beforeId={antesDe} />
        </Source>
      )}
      <Source id="mundo" type="geojson" data={MUNDO}>
        {listo && <Layer {...c.atenuar} paint={{ ...c.atenuar.paint, "fill-opacity": 0.25 }} beforeId={antesDe} />}
      </Source>
      {comuna && listo && (
        <Source id="comuna" type="geojson" data={comuna}>
          {!sectores && (
            <Layer {...c.relleno} paint={{ ...c.relleno.paint, "fill-opacity": 0.45 }} beforeId={antesDe} />
          )}
          <Layer {...c.seleccion} />
        </Source>
      )}
      {sectores && listo && (
        <Source id="sectores" type="geojson" data={sectores}>
          <Layer {...c.sectores} paint={{ ...c.sectores.paint, "fill-opacity": 0.78 }} beforeId={antesDe} />
          <Layer {...c.sectoresBorde} beforeId={antesDe} />
          <Layer
            id="sector-elegido"
            type="line"
            filter={["==", ["get", "sector_id"], elegido ?? ""]}
            paint={{ "line-color": tema === "oscuro" ? "#ffffff" : "#191b1d", "line-width": 3 }}
          />
        </Source>
      )}
      <Source id="zonas" type="geojson" data={fuegos.zonas}>
        {listo && <Layer {...c.zonas} minzoom={0} />}
      </Source>
      <Source id="fuegos" type="geojson" data={fuegos.puntos}>
        {listo && <Layer {...c.flecha} />}
        {listo && <Layer {...c.pulso} />}
      </Source>
    </Map>
  );
}
