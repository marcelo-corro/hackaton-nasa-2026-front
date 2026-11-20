import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre";
import { useMemo, useState } from "react";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import { useActivos, useGeometrias } from "~/lib/datos";
import type { Nivel } from "~/lib/esquemas";
import { ESTILO_MAPA, useTema } from "~/lib/tema";
import { capas, FUENTE_RELIEVE, geoIncendios, MUNDO } from "./capas";
import { prepararMapa } from "./estilo";
import { agregarIconos } from "./iconos";

type Props = { id: string; caja: [number, number, number, number]; nivel?: Nivel };

/** Mapa chico de la ficha: la comuna con el color de su nivel, el relieve e incendios activos cercanos. */
export default function MapaComuna({ id, caja, nivel }: Props) {
  const [tema] = useTema();
  const { data: geo } = useGeometrias();
  const { data: activos } = useActivos();
  const c = capas(tema);
  const [antesDe, setAntesDe] = useState<string>();
  const [listo, setListo] = useState(false);

  const comuna = useMemo(() => {
    const f = geo?.features.find((x) => x.properties.region_id === id);
    return f ? { ...f, properties: { ...f.properties, nivel } } : null;
  }, [geo, id, nivel]);
  const fuegos = useMemo(() => geoIncendios(activos?.incendios ?? []), [activos]);

  return (
    <Map
      key={tema}
      mapStyle={ESTILO_MAPA[tema]}
      initialViewState={{ bounds: [caja[0], caja[1], caja[2], caja[3]], fitBoundsOptions: { padding: 28 } }}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      cooperativeGestures
      dragRotate={false}
      pitchWithRotate={false}
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
          <Layer {...c.relleno} paint={{ ...c.relleno.paint, "fill-opacity": 0.45 }} beforeId={antesDe} />
          <Layer {...c.seleccion} />
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
