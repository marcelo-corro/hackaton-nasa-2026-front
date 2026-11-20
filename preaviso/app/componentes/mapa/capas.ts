// Capas y geometrías compartidas por los mapas (MapLibre lee colores hex, no clases).
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { LayerProps } from "react-map-gl/maplibre";
import type { Incendio, Nivel } from "~/lib/esquemas";
import { HEX_NIVEL } from "~/lib/formato";
import type { Tema } from "~/lib/tema";

export const CAJA_CHILE: [[number, number], [number, number]] = [
  [-76.2, -56.2],
  [-66.0, -17.3],
];

/** Polígono del mundo: se dibuja bajo las comunas para atenuar los países vecinos. */
export const MUNDO: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
  },
};

/** Círculo geográfico aproximado (suficiente para radios de pocos km). */
export function circulo(lon: number, lat: number, km: number, puntos = 64): Polygon {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const anillo: [number, number][] = [];
  for (let i = 0; i <= puntos; i++) {
    const t = (i / puntos) * 2 * Math.PI;
    anillo.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: "Polygon", coordinates: [anillo] };
}

export function geoIncendios(incendios: Incendio[]) {
  const puntos: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: incendios.map((i) => ({
      type: "Feature",
      properties: { id: i.id, comuna: i.comuna, focos: i.focos_ultimo_dia },
      geometry: { type: "Point", coordinates: [i.lon, i.lat] },
    })),
  };
  const zonas: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: incendios.flatMap((i) => [
      { type: "Feature" as const, properties: { zona: 85 }, geometry: circulo(i.lon, i.lat, i.radio_km_85) },
      { type: "Feature" as const, properties: { zona: 70 }, geometry: circulo(i.lon, i.lat, i.radio_km_70) },
    ]),
  };
  return { puntos, zonas };
}

export const colorNivel: unknown[] = [
  "match",
  ["get", "nivel"],
  ...(Object.entries(HEX_NIVEL) as [Nivel, string][]).flat(),
  "#c9ccd0",
];

export const capas = (tema: Tema) => {
  const oscuro = tema === "oscuro";
  const fondo = oscuro ? "#0e1012" : "#f5f4f0";
  return {
    atenuar: {
      id: "atenuar",
      type: "fill",
      paint: { "fill-color": fondo, "fill-opacity": oscuro ? 0.55 : 0.6 },
    } satisfies LayerProps,
    relleno: {
      id: "comunas-relleno",
      type: "fill",
      paint: {
        "fill-color": colorNivel as never,
        // Más transparente al acercarse, para ver caminos y poblados bajo el color.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.92, oscuro ? 0.66 : 0.74],
          10,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.6, oscuro ? 0.36 : 0.42],
        ],
      },
    } satisfies LayerProps,
    borde: {
      id: "comunas-borde",
      type: "line",
      paint: {
        "line-color": oscuro ? "#0e1012" : "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.8, 11, 1.4],
        "line-opacity": 0.8,
      },
    } satisfies LayerProps,
    seleccion: {
      id: "comunas-seleccion",
      type: "line",
      paint: { "line-color": oscuro ? "#ecebe7" : "#191b1d", "line-width": 2.2 },
    } satisfies LayerProps,
    zonas: {
      id: "incendios-zonas",
      type: "fill",
      paint: {
        "fill-color": oscuro ? "#a78bfa" : "#7c3aed",
        "fill-opacity": ["match", ["get", "zona"], 70, 0.22, 0.12],
        "fill-outline-color": oscuro ? "#a78bfa" : "#7c3aed",
      },
      minzoom: 7,
    } satisfies LayerProps,
    halo: {
      id: "incendios-halo",
      type: "circle",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 11, 12, 16],
        "circle-color": oscuro ? "#a78bfa" : "#7c3aed",
        "circle-opacity": 0.25,
        "circle-blur": 0.4,
      },
    } satisfies LayerProps,
    punto: {
      id: "incendios-punto",
      type: "circle",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.8, 8, 4.5, 12, 6],
        "circle-color": oscuro ? "#c4b5fd" : "#6d28d9",
        "circle-stroke-color": fondo,
        "circle-stroke-width": 1.2,
      },
    } satisfies LayerProps,
  };
};
