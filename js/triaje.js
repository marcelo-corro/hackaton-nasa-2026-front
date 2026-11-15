// Reglas puras de los incendios del día (sin DOM, para poder probarlas con node --test).
// Contrato de datos: guia-front-mvp.md §5, archivo web/datos/ext/triaje-<AAAA-MM-DD>.json.
// Cada día se ve completo: todos los incendios a la vez, con un solo valor de probabilidad por incendio.

export const FECHAS = ["2026-01-16", "2026-01-17", "2026-01-18"];
export const FECHA_INICIAL = "2026-01-17";
export const diaValido = (d) => (FECHAS.includes(d) ? d : FECHA_INICIAL);
export const rutaTriaje = (fecha) => `triaje-${diaValido(fecha)}.json`;

/** Un incendio está en alerta si su probabilidad de no control el día de inicio llega al umbral del modelo. */
export const UMBRAL_ALERTA = 0.5;
export const esAlerta = (i, umbral = UMBRAL_ALERTA) => i.p_no_control_dia >= umbral;

/** Hora decimal de inicio de un incendio: "2026-01-17 13:20" da 13,33. */
export function horaDe(incendio) {
  const [h, m] = incendio.f_inicio.slice(11, 16).split(":").map(Number);
  return h + m / 60;
}
export const horaTxt = (hora) => `${String(Math.floor(hora)).padStart(2, "0")}:${String(Math.round((hora % 1) * 60)).padStart(2, "0")}`;

/**
 * Cola de despacho: de mayor a menor probabilidad de no control el día de inicio; a igual probabilidad, el que empezó antes.
 * Devuelve copias con `prioridad` de 1 a N calculada solo entre los incendios recibidos.
 */
export function ordenarCola(incendios) {
  return [...incendios]
    .sort((a, b) => b.p_no_control_dia - a.p_no_control_dia || horaDe(a) - horaDe(b) || a.id.localeCompare(b.id))
    .map((i, n) => ({ ...i, prioridad: n + 1 }));
}

/** Filtro por región (código de dos dígitos) y por comuna (código de cinco), según donde cae el incendio. Sin filtro, todos. */
export const filtrar = (incendios, { region = null, comuna = null } = {}) =>
  incendios.filter((i) => (!region || i.region_id === region) && (!comuna || i.comuna_id === comuna));

/** Clase de probabilidad 0 a 4 con los mismos cortes que el mapa de riesgo (para el color y el texto). */
export const CORTES_P = [0.2, 0.4, 0.6, 0.8];
export const claseP = (p) => CORTES_P.filter((c) => p >= c).length;
export const NIVELES_P = ["Muy baja", "Baja", "Media", "Alta", "Muy alta"];
export const COLORES_P = ["#34a853", "#fbbc04", "#fb8c00", "#ea4335", "#a50e0e"];
export const colorP = (p) => COLORES_P[claseP(p)];

/**
 * Sector circular para dibujar la zona probable de avance. Rumbo en grados desde el norte, hacia donde avanza el fuego.
 * Devuelve [[lat, lon], ...] con el vértice en el punto de inicio.
 */
export function sector(lat, lon, rumboGrados, radioKm, semiAngulo = 28, pasos = 14) {
  const pts = [[lat, lon]];
  for (let k = 0; k <= pasos; k++) {
    const b = ((rumboGrados - semiAngulo + (2 * semiAngulo * k) / pasos) * Math.PI) / 180;
    pts.push([lat + (radioKm * Math.cos(b)) / 111, lon + (radioKm * Math.sin(b)) / (111 * Math.cos((lat * Math.PI) / 180))]);
  }
  return pts;
}
