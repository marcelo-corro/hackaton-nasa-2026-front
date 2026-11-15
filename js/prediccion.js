// Reglas puras del producto nuevo (sin DOM, para poder probarlas con node --test).
// El contrato de datos está en web/datos/ext/CONTRATO.md.

export const RANGOS = [
  { id: "esta-semana", nombre: "Esta semana" },
  { id: "proxima-semana", nombre: "Próxima semana" },
  { id: "dentro-2-semanas", nombre: "Dentro de 2 semanas" },
  { id: "este-mes", nombre: "Este mes" },
  { id: "proximo-mes", nombre: "Próximo mes" },
];
export const RANGO_INICIAL = "esta-semana";
export const rangoValido = (id) => (RANGOS.some((r) => r.id === id) ? id : RANGO_INICIAL);

// Supuestos con los que se pone plata a un incendio. Son una propuesta del equipo, sin fuente: el municipio los edita.
export const SUPUESTOS_FABRICA = {
  vsl_clp: 1_500_000_000,
  valor_propiedad_ha_clp: 15_000_000,
  costo_combate_ha_clp: 2_500_000,
};

export const rutaChile = (rango) => `prediccion-chile-${rangoValido(rango)}.json`;
export const rutaComuna = (codigo, rango) => `prediccion-comuna-${codigo}-${rangoValido(rango)}.json`;

/** Clases del mapa de calor por probabilidad en el periodo. Escala fija para poder comparar rangos y comunas. */
export const CORTES_RIESGO = [0.1, 0.25, 0.45, 0.65];
export const claseRiesgo = (p, cortes = CORTES_RIESGO) => (p == null ? -1 : cortes.filter((c) => p >= c).length);
/** Para las celdas la probabilidad es mucho menor que la de la comuna: se reparte entre el mínimo y el máximo de la propia comuna. */
export function cortesRelativos(valores, clases = 5) {
  const v = valores.filter((x) => x != null);
  if (!v.length) return [];
  const min = Math.min(...v), max = Math.max(...v);
  if (max === min) return [];
  return Array.from({ length: clases - 1 }, (_, i) => min + ((i + 1) * (max - min)) / clases);
}

/** Una causa es modificable si el catálogo del archivo lo dice. */
export function causasConEtiqueta(unidad, catalogo) {
  const por = Object.fromEntries(catalogo.causas.map((c) => [c.id, c]));
  return unidad.causas
    .map((c) => ({ id: c.id, pct: c.pct, nombre: por[c.id]?.nombre ?? c.id, modificable: !!por[c.id]?.modificable }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Beneficio esperado en CLP de bajar la probabilidad de incendio.
 * Se pondera por lo que se pierde si ocurre: vidas, propiedad quemada y costo de combate, según los supuestos.
 * beneficio = (reducción en pp / 100) x (vidas si hay incendio x VSL + ha esperadas x (propiedad por ha + combate por ha))
 */
export function beneficio(reduccionPp, unidad, supuestos = SUPUESTOS_FABRICA) {
  const f = reduccionPp / 100;
  const vidas = f * unidad.vidas_si_incendio * supuestos.vsl_clp;
  const propiedad = f * unidad.ha[1] * supuestos.valor_propiedad_ha_clp;
  const otro = f * unidad.ha[1] * supuestos.costo_combate_ha_clp;
  return { vidas, propiedad, otro, total: vidas + propiedad + otro };
}

export const CRITERIOS = { reduccion: "Reducción de probabilidad", razon: "Beneficio sobre costo" };

/**
 * Arma las recomendaciones de una unidad (comuna o celda). Solo entran acciones cuya causa es modificable.
 * Orden: de mayor a menor por `criterio` ("reduccion" o "razon"); el desempate es el otro criterio y luego el nombre.
 */
export function recomendar(unidad, catalogo, supuestos = SUPUESTOS_FABRICA, criterio = "reduccion") {
  const causas = Object.fromEntries(catalogo.causas.map((c) => [c.id, c]));
  const acciones = Object.fromEntries(catalogo.acciones.map((a) => [a.id, a]));
  const lista = (unidad.recomendaciones ?? [])
    .filter((r) => acciones[r.accion] && causas[acciones[r.accion].causa]?.modificable)
    .map((r) => {
      const b = beneficio(r.reduccion_pp, unidad, supuestos);
      return {
        accion: r.accion, nombre: acciones[r.accion].nombre, causa: acciones[r.accion].causa,
        reduccion_pp: r.reduccion_pp, costo_clp: r.costo_clp, beneficio: b,
        razon: r.costo_clp > 0 ? b.total / r.costo_clp : null,
      };
    });
  const clave = (r) => (criterio === "razon" ? r.razon ?? -Infinity : r.reduccion_pp);
  const otra = (r) => (criterio === "razon" ? r.reduccion_pp : r.razon ?? -Infinity);
  return lista.sort((a, b) => clave(b) - clave(a) || otra(b) - otra(a) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Convierte el arreglo compacto de una celda del contrato (ca, rc, ha, ex, p) en la misma forma que el resumen de la comuna. */
export function unidadDeCelda(celda, archivo) {
  const { causas, acciones } = archivo.catalogo;
  const comuna = archivo.resumen;
  return {
    prob: celda.p, ha: celda.ha, personas_expuestas: celda.ex,
    // Las vidas de la celda se reparten en proporción a las personas expuestas de la comuna.
    vidas_si_incendio: comuna.personas_expuestas > 0 ? comuna.vidas_si_incendio * (celda.ex / comuna.personas_expuestas) : 0,
    causas: causas.map((c, i) => ({ id: c.id, pct: celda.ca[i] })),
    recomendaciones: acciones.map((a, i) => ({ accion: a.id, reduccion_pp: celda.rc[i][0], costo_clp: celda.rc[i][1] })),
  };
}

/** Las comunas con más riesgo en el periodo, para la lista de la vista Chile. */
export function masRiesgosas(items, nombres, n = 10) {
  return [...items].sort((a, b) => b.p - a.p || (nombres[a.region_id] ?? "").localeCompare(nombres[b.region_id] ?? "", "es")).slice(0, n);
}

/** Estado de rango, región y comuna a partir de un hash tipo `#comuna=05101&rango=este-mes` o `#region=05&rango=este-mes`. */
export function leerHash(hash) {
  const q = new URLSearchParams(String(hash).replace(/^#/, ""));
  const comuna = /^\d{5}$/.test(q.get("comuna") ?? "") ? q.get("comuna") : null;
  // La región son los dos primeros dígitos del código de comuna: si hay comuna, manda la suya.
  const region = comuna ? comuna.slice(0, 2) : /^\d{2}$/.test(q.get("region") ?? "") ? q.get("region") : null;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get("dia") ?? "") ? q.get("dia") : null;
  return { rango: rangoValido(q.get("rango")), dia, region, comuna, vista: q.get("vista"), incendio: /^\d{3,12}$/.test(q.get("incendio") ?? "") ? q.get("incendio") : null };
}
export function aHash({ dia, region, comuna, vista, incendio }) {
  const q = new URLSearchParams();
  if (vista === "metodologia") q.set("vista", vista);
  if (comuna) q.set("comuna", comuna);
  else if (region) q.set("region", region);
  if (dia) q.set("dia", dia);
  if (incendio) q.set("incendio", incendio);
  return "#" + q.toString();
}

// Formatos en pesos chilenos.
export const clp = (v) => (v == null ? "—" : "$" + Math.round(v).toLocaleString("es-CL"));
export function clpCorto(v) {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return "$" + (v / 1e9).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " mil millones";
  if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " millones";
  return clp(v);
}
