// Única puerta de entrada a los datos publicados. Las vistas usan estos hooks; no hacen fetch por su cuenta.
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { z } from "zod";
import {
  Activos,
  Comunas,
  CONTRATOS_SOPORTADOS,
  Manifest,
  Recomendaciones,
  Riesgo,
  type Horizonte,
} from "./esquemas";
import { armarSectores, type Sectores, SectoresDia, SectoresFijo } from "./sectores";

export const URL_DATOS =
  import.meta.env.VITE_URL_DATOS ?? "https://marcelo-corro.github.io/hackaton-nasa-2026-datos/";

const ARCHIVO_RIESGO: Record<Horizonte, string> = {
  "24": "riesgo/ultimo.json",
  "48": "riesgo/48h.json",
  "168": "riesgo/7d.json",
};

async function leer<T>(ruta: string, esquema: z.ZodType<T>): Promise<T> {
  const resp = await fetch(new URL(ruta, URL_DATOS));
  if (!resp.ok) throw new Error(`No se pudo leer ${ruta} (${resp.status})`);
  const json = await resp.json();
  const contrato = (json as { contrato?: string }).contrato;
  if (contrato && !CONTRATOS_SOPORTADOS.includes(contrato)) {
    console.warn(`${ruta} viene con contrato ${contrato}; el front conoce ${CONTRATOS_SOPORTADOS.join(", ")}`);
  }
  const r = esquema.safeParse(json);
  if (!r.success) {
    console.error(`${ruta} no calza con el contrato`, r.error.issues.slice(0, 5));
    throw new Error(`Los datos de ${ruta} cambiaron de forma`);
  }
  return r.data;
}

// Los datos cambian una vez al día: no hace falta volver a pedirlos mientras la página esté abierta.
const FRESCO = 30 * 60 * 1000;

export const useManifest = () =>
  useQuery({ queryKey: ["manifest"], queryFn: () => leer("manifest.json", Manifest), staleTime: FRESCO });

export const useRiesgo = (h: Horizonte) =>
  useQuery({ queryKey: ["riesgo", h], queryFn: () => leer(ARCHIVO_RIESGO[h], Riesgo), staleTime: FRESCO });

export const useComunas = () =>
  useQuery({ queryKey: ["comunas"], queryFn: () => leer("comunas.json", Comunas), staleTime: FRESCO });

export const useActivos = () =>
  useQuery({ queryKey: ["activos"], queryFn: () => leer("avance/activos.json", Activos), staleTime: FRESCO });

export const useRecomendaciones = () =>
  useQuery({
    queryKey: ["recomendaciones"],
    queryFn: () => leer("recomendaciones.json", Recomendaciones),
    staleTime: Infinity,
  });

export type PropsSector = {
  sector_id: string;
  lat: number;
  lon: number;
  percentil_en_comuna: number;
  /** Si hay fuego en la comuna el día siguiente, probabilidad de que caiga en este sector (modelo B). */
  prob_si_fuego_en_comuna: number | null;
  prob_incendio_grande: number | null;
  rasgos: string[];
  pct_interfaz: number | null;
  pct_pastizal: number | null;
  pct_bosque_matorral: number | null;
  pct_cultivo: number | null;
  pendiente_media: number | null;
  dias_con_fuego: number;
  ultimo_fuego: string | null;
};

/**
 * Sectores de 1 km de una comuna del piloto (solo las de manifest.sectores.regiones). Desde el contrato v0.9 vienen en
 * dos archivos compactos (fijo y diario, ver lib/sectores.ts); con datos anteriores, en un GeoJSON por comuna.
 */
export const useSectores = (id: string | null) => {
  const { data: manifest } = useManifest();
  const archivos = manifest?.archivos;
  return useQuery({
    queryKey: ["sectores", id, archivos?.sectores_fijo ?? "geojson"],
    queryFn: async (): Promise<Sectores> => {
      if (archivos?.sectores_fijo && archivos.sectores_dia && id) {
        const ruta = (plantilla: string) => plantilla.replace("{region_id}", id);
        const [fijo, dia] = await Promise.all([
          leer(ruta(archivos.sectores_fijo), SectoresFijo),
          leer(ruta(archivos.sectores_dia), SectoresDia),
        ]);
        return armarSectores(fijo, dia);
      }
      const resp = await fetch(new URL(`sectores/${id}.geojson`, URL_DATOS));
      if (!resp.ok) throw new Error(`No se pudo leer sectores/${id}.geojson (${resp.status})`);
      return (await resp.json()) as Sectores;
    },
    enabled: !!id && !!manifest,
    staleTime: FRESCO,
  });
};

export type PropsComuna = { region_id: string; nombre: string; region: string };
export type Geometrias = FeatureCollection<Polygon | MultiPolygon, PropsComuna>;

export const useGeometrias = () =>
  useQuery({
    queryKey: ["geometrias"],
    queryFn: async () => {
      const resp = await fetch(new URL("regiones.geojson", URL_DATOS));
      if (!resp.ok) throw new Error(`No se pudo leer regiones.geojson (${resp.status})`);
      return (await resp.json()) as Geometrias;
    },
    staleTime: Infinity,
  });
