import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Horizonte, Nivel } from "./esquemas";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

const fechaLarga = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "UTC" });
const fechaCorta = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
const diaSemana = new Intl.DateTimeFormat("es-CL", { weekday: "long", timeZone: "UTC" });

const aFecha = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const sumarDias = (iso: string, d: number) => {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + d);
  return f;
};

const nombreMes = new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" });

export const fecha = (iso: string) => fechaLarga.format(aFecha(iso));
export const fechaBreve = (iso: string) => fechaCorta.format(aFecha(iso)).replace(".", "");
export const dia = (iso: string) => diaSemana.format(aFecha(iso));
export const mes = (iso: string) => nombreMes.format(aFecha(iso));
/** La fecha (AAAA-MM-DD) d días después. */
export const despues = (iso: string, d: number) => sumarDias(iso, d).toISOString().slice(0, 10);

export const porcentaje = (p: number) =>
  `${(p * 100).toLocaleString("es-CL", { maximumFractionDigits: p < 0.1 ? 1 : 0 })} %`;

export const NIVELES: Record<Nivel, { nombre: string; corto: string; orden: number }> = {
  bajo: { nombre: "Riesgo bajo", corto: "Bajo", orden: 0 },
  medio: { nombre: "Riesgo medio", corto: "Medio", orden: 1 },
  alto: { nombre: "Riesgo alto", corto: "Alto", orden: 2 },
  muy_alto: { nombre: "Riesgo muy alto", corto: "Muy alto", orden: 3 },
};

/** Clases de color por nivel (definidas en app.css, con versión oscura). */
export const COLOR_NIVEL: Record<Nivel, { fondo: string; texto: string; punto: string; borde: string }> = {
  bajo: { fondo: "bg-bajo-suave", texto: "text-bajo-fuerte", punto: "bg-bajo", borde: "border-bajo" },
  medio: { fondo: "bg-medio-suave", texto: "text-medio-fuerte", punto: "bg-medio", borde: "border-medio" },
  alto: { fondo: "bg-alto-suave", texto: "text-alto-fuerte", punto: "bg-alto", borde: "border-alto" },
  muy_alto: { fondo: "bg-muyalto-suave", texto: "text-muyalto-fuerte", punto: "bg-muyalto", borde: "border-muyalto" },
};

/** Colores del mapa (MapLibre no lee clases). */
export const HEX_NIVEL: Record<Nivel, string> = {
  bajo: "#9cc5a1",
  medio: "#f2c14e",
  alto: "#f07c2b",
  muy_alto: "#c8281e",
};

export const HORIZONTES: { id: Horizonte; nombre: string; titulo: (desde: string) => string }[] = [
  { id: "24", nombre: "24 h", titulo: (d) => `${capital(dia(d))} ${fechaBreve(d)}` },
  { id: "48", nombre: "48 h", titulo: (d) => `Hasta el ${dia(sumarDias(d, 1).toISOString())}` },
  { id: "168", nombre: "7 días", titulo: (d) => `Hasta el ${fechaBreve(sumarDias(d, 6).toISOString())}` },
];

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Días entre hoy (hora de Chile) y la fecha: 0 = hoy, 1 = mañana, negativo = ya pasó. */
export function diasDesdeHoy(iso: string): number {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  return Math.round((aFecha(iso).getTime() - aFecha(hoy).getTime()) / 86_400_000);
}

/** Para usar dentro de una frase: "hoy", "mañana" o "el domingo 15 de noviembre". */
export function cuandoFrase(iso: string): string {
  const dif = diasDesdeHoy(iso);
  if (dif === 0) return "hoy";
  if (dif === 1) return "mañana";
  return `el ${dia(iso)} ${fecha(iso)}`;
}

/** Para usar dentro de una frase, con la fecha: "hoy, sábado 21 de noviembre" o "el sábado 21 de noviembre". */
export function cuandoConFecha(iso: string): string {
  const c = cuandoFrase(iso);
  return c === "hoy" || c === "mañana" ? `${c}, ${dia(iso)} ${fecha(iso)}` : c;
}

/**
 * Cómo se compara la probabilidad de foco del día con lo normal: la parte de los días de ese mes con focos en la
 * comuna (2012-2026, en %; es la climatología contra la que se mide el modelo).
 */
export function frenteALoNormal(prob: number, normalPct: number): string {
  const normal = normalPct / 100;
  if (normal < 0.005) return prob < 0.005 ? "parecido a lo normal" : "sobre lo normal";
  const veces = prob / normal;
  if (veces >= 1.95) return `${veces.toLocaleString("es-CL", { maximumFractionDigits: veces < 10 ? 1 : 0 })} veces lo normal`;
  if (veces >= 1.25) return "sobre lo normal";
  if (veces > 0.8) return "parecido a lo normal";
  return "bajo lo normal";
}

/** "Hoy", "Mañana" o el día de la semana, según la fecha de Chile del visitante. */
export function cuando(iso: string): string {
  const dif = diasDesdeHoy(iso);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Mañana";
  if (dif === -1) return "Ayer";
  return capital(dia(iso));
}

/** Encabezado de un día: "Mañana, viernes 20 de noviembre" o "Viernes 20 de noviembre". */
export function diaCompleto(iso: string): string {
  const c = cuando(iso);
  const d = `${dia(iso)} ${fecha(iso)}`;
  return c === capital(dia(iso)) ? capital(d) : `${c}, ${d}`;
}
