// Forma de los datos que publica el back (contrato v0.8, aivital-incendios-back/contracts/README.md).
// Los esquemas validan solo lo que el front usa; los campos nuevos (cambios aditivos) se ignoran sin romper.
import { z } from "zod";

export const CONTRATOS_SOPORTADOS = ["0.8"];

export const Nivel = z.enum(["bajo", "medio", "alto", "muy_alto"]);
export type Nivel = z.infer<typeof Nivel>;

export const Horizonte = z.enum(["24", "48", "168"]);
export type Horizonte = z.infer<typeof Horizonte>;

const RiesgoItem = z.object({
  region_id: z.string(),
  prob_foco: z.number(),
  percentil: z.number().nullable().optional(),
  nivel: Nivel,
});

export const Riesgo = z.object({
  contrato: z.string(),
  valido_para: z.string(),
  valido_hasta: z.string().optional(),
  horizonte_horas: z.number(),
  modelo: z.string(),
  orientativo: z.boolean().optional(),
  nota: z.string().optional(),
  items: z.array(RiesgoItem),
});
export type Riesgo = z.infer<typeof Riesgo>;

const RiesgoHorizonte = z.object({ prob_foco: z.number(), nivel: Nivel });

const Clima = z.object({
  fecha_clima: z.string(),
  /** Aditivo (21-11-2026): true si es el pronóstico de Open-Meteo del día que se predice; si no, NASA POWER. */
  pronostico: z.boolean().optional(),
  fuente: z.string().optional(),
  tmax: z.number().nullable(),
  tmax_percentil: z.number().nullable().optional(),
  hrmin: z.number().nullable(),
  hrmin_percentil: z.number().nullable().optional(),
  viento_max_kmh: z.number().nullable(),
  viento_percentil: z.number().nullable().optional(),
  dias_sin_lluvia: z.number().nullable(),
  dias_sin_lluvia_percentil: z.number().nullable().optional(),
  condiciones: z.array(z.string()),
});

export const ComunaDatos = z.object({
  region_id: z.string(),
  nombre: z.string(),
  region: z.string(),
  riesgo: z.record(Horizonte, RiesgoHorizonte),
  clima_ultimo_dia: Clima.nullable(),
  recomendaciones: z.record(Horizonte, z.array(z.string())),
  fuego_activo: z.boolean(),
  dias_con_fuego_7d: z.number(),
  ultimo_fuego: z.string().nullable(),
  pct_dias_con_fuego_mes: z.number().nullable(),
  motivos: z.array(z.string()),
});
export type ComunaDatos = z.infer<typeof ComunaDatos>;

export const Comunas = z.object({
  contrato: z.string(),
  valido_para: z.string(),
  ultimo_dato_focos: z.string(),
  fecha_clima: z.string(),
  nota: z.string(),
  comunas: z.array(ComunaDatos),
});
export type Comunas = z.infer<typeof Comunas>;

const Incendio = z.object({
  id: z.string(),
  region_id: z.string(),
  comuna: z.string(),
  region: z.string(),
  lat: z.number(),
  lon: z.number(),
  inicio: z.string(),
  ultimo_foco: z.string(),
  focos_ultimo_dia: z.number(),
  focos_incendio: z.number(),
  dias_con_focos: z.number(),
  radio_km_70: z.number(),
  radio_km_85: z.number(),
  viento: z
    .object({ hacia_grados: z.number().nullable(), velocidad_ms: z.number().nullable(), fuerte: z.boolean() })
    .nullable()
    .optional(),
  mostrar_flecha: z.boolean(),
});
export type Incendio = z.infer<typeof Incendio>;

export const Activos = z.object({
  contrato: z.string(),
  ultimo_dato: z.string(),
  nota: z.string(),
  incendios: z.array(Incendio),
});
export type Activos = z.infer<typeof Activos>;

const TextoFuente = z.object({ texto: z.string(), fuente: z.string().nullable() });

export const Recomendaciones = z.object({
  rasgos: z.record(z.string(), z.string()),
  condiciones: z.record(z.string(), TextoFuente),
  recomendaciones: z.record(z.string(), TextoFuente),
  fuentes: z.record(z.string(), z.object({ nombre: z.string(), url: z.string() })),
});
export type Recomendaciones = z.infer<typeof Recomendaciones>;

export const Manifest = z.object({
  contrato: z.string(),
  generado_utc: z.string(),
  sectores: z
    .object({
      codigo_region: z.string(),
      regiones: z.array(z.string()),
      modelo_b: z.object({ nota: z.string() }).optional(),
    })
    .optional(),
  datos: z
    .object({
      valido_para: z.string(),
      ultimo_dato_focos: z.string(),
      clima_hasta: z.string(),
      clima_rezago_dias: z.number(),
      nota: z.string(),
    })
    .optional(),
});
export type Manifest = z.infer<typeof Manifest>;
