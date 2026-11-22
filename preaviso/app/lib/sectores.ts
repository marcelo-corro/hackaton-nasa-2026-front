// Sectores de 1 km en el formato compacto del back (contrato v0.9): un archivo fijo por comuna (grilla y capas, no
// cambia a diario) y uno diario (modelo B, historial y rasgos), ambos en columnas. Aquí se arma el mismo GeoJSON que
// publicaba el back hasta la v0.8, para que el mapa y la lista no cambien.
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";
import type { PropsSector } from "./datos";
import { anilloCelda, centroCelda, type Traslacion } from "./grilla";

const num = z.number();
const numONulo = z.number().nullable();

export const SectoresFijo = z.object({
  contrato: z.string(),
  region_id: z.string(),
  n: z.number(),
  version: z.string(),
  grilla: z.object({
    lado_m: num,
    ix0: num,
    iy0: num,
    sad69_a_wgs84: z.tuple([num, num, num]),
  }),
  dx: z.array(num),
  dy: z.array(num),
  area_km2: z.array(numONulo),
  pct_interfaz: z.array(numONulo),
  pct_pastizal: z.array(numONulo),
  pct_bosque_matorral: z.array(numONulo),
  pct_cultivo: z.array(numONulo),
  pct_construido: z.array(numONulo),
  pendiente_media: z.array(numONulo),
  bordes: z.object({
    i: z.array(num),
    geometria: z.array(z.custom<Polygon | MultiPolygon>((g) => typeof g === "object" && g !== null)),
    punto: z.array(z.tuple([num, num])),
  }),
});
export type SectoresFijo = z.infer<typeof SectoresFijo>;

export const SectoresDia = z.object({
  contrato: z.string(),
  region_id: z.string(),
  n: z.number(),
  version_fijo: z.string(),
  fecha_prediccion: z.string().nullable(),
  prob_si_fuego_en_comuna: z.array(numONulo),
  prob_incendio_grande: z.array(numONulo),
  percentil_en_comuna: z.array(numONulo),
  dias_con_fuego: z.array(num),
  focos: z.array(num),
  ultimo_fuego: z.array(z.string().nullable()),
  incendios_grandes: z.array(num),
  mayor_incendio_focos: z.array(num),
  rasgos: z.array(num),
  combinaciones: z.array(
    z.object({
      rasgos: z.array(z.string()),
      exposicion: num,
      recomendaciones: z.record(z.string(), z.array(z.string())),
    }),
  ),
});
export type SectoresDia = z.infer<typeof SectoresDia>;

export type Sectores = FeatureCollection<Polygon | MultiPolygon, PropsSector>;

/** Arma el GeoJSON de los sectores de una comuna a partir de sus dos archivos (deben ser de la misma versión). */
export function armarSectores(fijo: SectoresFijo, dia: SectoresDia): Sectores {
  if (dia.version_fijo !== fijo.version || dia.n !== fijo.n || fijo.dx.length !== fijo.n) {
    throw new Error(`Los archivos de sectores de ${fijo.region_id} no son de la misma versión`);
  }
  const { lado_m, ix0, iy0, sad69_a_wgs84 } = fijo.grilla;
  const traslacion = sad69_a_wgs84 as Traslacion;
  const bordes = new Map(fijo.bordes.i.map((i, j) => [i, j]));
  const features: Feature<Polygon | MultiPolygon, PropsSector>[] = [];
  for (let i = 0; i < fijo.n; i++) {
    const ix = ix0 + fijo.dx[i];
    const iy = iy0 + fijo.dy[i];
    const j = bordes.get(i);
    const geometry: Polygon | MultiPolygon =
      j === undefined ? { type: "Polygon", coordinates: [anilloCelda(ix, iy, lado_m, traslacion)] } : fijo.bordes.geometria[j];
    const [lon, lat] = j === undefined ? centroCelda(ix, iy, lado_m, traslacion) : fijo.bordes.punto[j];
    const combo = dia.combinaciones[dia.rasgos[i]];
    const percentil = dia.percentil_en_comuna[i];
    features.push({
      type: "Feature",
      geometry,
      properties: {
        sector_id: `${fijo.region_id}_${ix}_${iy}`,
        region_id: fijo.region_id,
        lat,
        lon,
        ...(percentil !== null && { percentil_en_comuna: percentil }),
        prob_si_fuego_en_comuna: dia.prob_si_fuego_en_comuna[i],
        prob_incendio_grande: dia.prob_incendio_grande[i],
        area_km2: fijo.area_km2[i],
        rasgos: combo.rasgos,
        exposicion: combo.exposicion,
        recomendaciones: combo.recomendaciones,
        pct_interfaz: fijo.pct_interfaz[i],
        pct_pastizal: fijo.pct_pastizal[i],
        pct_bosque_matorral: fijo.pct_bosque_matorral[i],
        pct_cultivo: fijo.pct_cultivo[i],
        pct_construido: fijo.pct_construido[i],
        pendiente_media: fijo.pendiente_media[i],
        dias_con_fuego: dia.dias_con_fuego[i],
        focos: dia.focos[i],
        ultimo_fuego: dia.ultimo_fuego[i],
        incendios_grandes: dia.incendios_grandes[i],
        mayor_incendio_focos: dia.mayor_incendio_focos[i],
      } as PropsSector,
    });
  }
  return { type: "FeatureCollection", features };
}
