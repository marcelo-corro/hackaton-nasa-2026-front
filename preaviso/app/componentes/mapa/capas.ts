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

export type PropsIncendio = {
  id: string;
  comuna: string;
  inicio: string;
  focos: number;
  flecha: boolean;
  hacia: number;
};

export function geoIncendios(incendios: Incendio[]) {
  const puntos: FeatureCollection<Point, PropsIncendio> = {
    type: "FeatureCollection",
    features: incendios.map((i) => ({
      type: "Feature",
      properties: {
        id: i.id,
        comuna: i.comuna,
        inicio: i.inicio,
        focos: i.focos_incendio,
        // Flecha solo con viento fuerte (contrato v0.7): el avance siguió el viento el 36 % de las veces.
        flecha: i.mostrar_flecha && i.viento?.hacia_grados != null,
        hacia: i.viento?.hacia_grados ?? 0,
      },
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

/** Relieve: Terrain Tiles de AWS Open Data (Mapzen/Tilezen, codificación terrarium). Sin llave. */
export const FUENTE_RELIEVE = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256,
  maxzoom: 13,
  encoding: "terrarium" as const,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Relieve: Terrain Tiles (AWS)</a>',
};

/** Orden dentro de la comuna (percentil 0-100): de crema a brasa oscura. */
const colorPercentil = [
  "interpolate",
  ["linear"],
  ["get", "percentil_en_comuna"],
  0,
  "#fbf0d0",
  50,
  "#f6c06a",
  80,
  "#ec7a35",
  95,
  "#c3301f",
  100,
  "#6b0f0b",
];

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
    relieve: {
      id: "relieve",
      type: "hillshade",
      paint: {
        "hillshade-exaggeration": oscuro ? 0.5 : 0.4,
        "hillshade-shadow-color": oscuro ? "rgba(0, 0, 0, 0.7)" : "rgba(60, 48, 36, 0.45)",
        "hillshade-highlight-color": oscuro ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.3)",
        "hillshade-accent-color": oscuro ? "rgba(0, 0, 0, 0.3)" : "rgba(60, 48, 36, 0.15)",
        "hillshade-illumination-direction": 315,
      },
    } satisfies LayerProps,
    flecha: {
      id: "incendios-flecha",
      type: "symbol",
      filter: ["==", ["get", "flecha"], true],
      layout: {
        "icon-image": "flecha",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.25],
        "icon-rotate": ["get", "hacia"],
        "icon-rotation-alignment": "map",
        "icon-offset": [0, -30],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    } satisfies LayerProps,
    pulso: {
      id: "incendios-pulso",
      type: "symbol",
      layout: {
        "icon-image": "pulso",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 8, 0.75, 12, 1],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    } satisfies LayerProps,
    sectores: {
      id: "sectores-relleno",
      type: "fill",
      paint: { "fill-color": colorPercentil as never, "fill-opacity": 0.82 },
    } satisfies LayerProps,
    sectores3d: {
      id: "sectores-3d",
      type: "fill-extrusion",
      paint: {
        "fill-extrusion-color": colorPercentil as never,
        // Altura por el cubo del percentil: resalta los sectores más probables sin tapar el resto.
        "fill-extrusion-height": ["*", ["^", ["/", ["get", "percentil_en_comuna"], 100], 3], 1800],
        "fill-extrusion-opacity": 0.88,
        "fill-extrusion-vertical-gradient": true,
      },
    } satisfies LayerProps,
    sectoresBorde: {
      id: "sectores-borde",
      type: "line",
      paint: { "line-color": fondo, "line-width": 0.4, "line-opacity": 0.6 },
    } satisfies LayerProps,
  };
};

export const RAMPA_PERCENTIL = "linear-gradient(90deg, #fbf0d0, #f6c06a 50%, #ec7a35 80%, #c3301f 95%, #6b0f0b)";
