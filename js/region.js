// Reglas puras del nivel región (sin DOM): promedio por región y grilla gruesa armada con las celdas de sus comunas.
import { enPoligono } from "./sintetico.js";

/** El código de región son los dos primeros dígitos del código de comuna. */
export const regionDe = (comunaId) => String(comunaId).slice(0, 2);
export const nombreCorto = (region) => String(region ?? "").replace(/^Región (Metropolitana de |de la |del |de )?/, "");

const normal = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Pone a cada incendio su comuna y su región según el contorno que contiene el punto. Si ningún contorno lo contiene
 * (la costa, polígonos simplificados) se usa el nombre de la comuna del registro y, si no, el contorno más cercano.
 * Devuelve copias con `comuna_id` y `region_id`.
 */
export function localizarIncendios(incendios, features) {
  const info = features.map((f) => ({ f, bbox: bboxDe(f), polis: polisDe(f), id: f.properties.region_id, nombre: normal(f.properties.nombre) }));
  return incendios.map((i) => {
    let hit = info.find((c) => i.lon >= c.bbox[0] && i.lon <= c.bbox[2] && i.lat >= c.bbox[1] && i.lat <= c.bbox[3] && c.polis.some((p) => enPoligono(i.lon, i.lat, p)));
    hit ??= info.find((c) => c.nombre === normal(i.comuna) && c.id.slice(0, 2) === i.reg_id);
    hit ??= info.find((c) => c.nombre === normal(i.comuna));
    hit ??= info.reduce((m, c) => {
      const d = Math.hypot((c.bbox[0] + c.bbox[2]) / 2 - i.lon, (c.bbox[1] + c.bbox[3]) / 2 - i.lat);
      return !m || d < m.d ? { c, d } : m;
    }, null)?.c;
    return { ...i, comuna_id: hit?.id ?? null, region_id: hit ? hit.id.slice(0, 2) : i.reg_id };
  });
}

/** Regiones con el promedio simple de la probabilidad de sus comunas, de mayor a menor. */
export function regionesDe(items, nombres) {
  const por = {};
  for (const it of items) {
    const id = regionDe(it.region_id);
    (por[id] ??= { id, nombre: nombres[it.region_id]?.region ?? "Región " + id, comunas: [] }).comunas.push(it);
  }
  return Object.values(por)
    .map((r) => ({ ...r, p: r.comunas.reduce((a, c) => a + c.p, 0) / r.comunas.length }))
    .sort((a, b) => b.p - a.p || a.nombre.localeCompare(b.nombre, "es"));
}

const polisDe = (feature) => (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates);
export function bboxDe(feature) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const pol of polisDe(feature)) for (const [x, y] of pol[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}
/** Las islas oceánicas (Rapa Nui, Juan Fernández) se dejan fuera del encuadre y de la grilla de la región. */
export const esContinental = (feature) => bboxDe(feature)[0] > -76.5;

/**
 * Grilla gruesa de una región. Cada celda toma cuatro puntos (uno por cuadrante), busca en cada uno la celda fina de la comuna
 * que lo contiene y promedia sus probabilidades: una celda de región resume unas cuatro celdas de comuna.
 * `comunas`: [{ id, feature, arch }] con el detalle de cada comuna (arch.grilla). Devuelve la misma forma que una grilla de comuna.
 */
export function grillaRegion(comunas, lado = 18) {
  const cs = comunas.filter((c) => c.arch?.grilla && esContinental(c.feature)).map((c) => {
    const g = c.arch.grilla, [w, s, e, n] = g.bbox;
    return { id: c.id, polis: polisDe(c.feature), bbox: bboxDe(c.feature), g, dx: (e - w) / g.columnas, dy: (n - s) / g.filas,
      por: new Map(g.celdas.map((k) => [k.f * 1000 + k.c, k.p])) };
  });
  if (!cs.length) return null;
  const w = Math.min(...cs.map((c) => c.bbox[0])), s = Math.min(...cs.map((c) => c.bbox[1]));
  const e = Math.max(...cs.map((c) => c.bbox[2])), n = Math.max(...cs.map((c) => c.bbox[3]));
  const ancho = (e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180), alto = n - s;
  const [columnas, filas] = ancho >= alto ? [lado, Math.max(4, Math.round((lado * alto) / ancho))] : [Math.max(4, Math.round((lado * ancho) / alto)), lado];
  const dx = (e - w) / columnas, dy = (n - s) / filas;
  const valorEn = (x, y) => {
    for (const c of cs) {
      if (x < c.bbox[0] || x > c.bbox[2] || y < c.bbox[1] || y > c.bbox[3]) continue;
      if (!c.polis.some((pol) => enPoligono(x, y, pol))) continue;
      const col = Math.min(c.g.columnas - 1, Math.floor((x - c.g.bbox[0]) / c.dx)), f = Math.min(c.g.filas - 1, Math.floor((c.g.bbox[3] - y) / c.dy));
      const p = c.por.get(f * 1000 + col);
      if (p != null) return { p, id: c.id };
    }
    return null;
  };
  const celdas = [];
  for (let f = 0; f < filas; f++) for (let col = 0; col < columnas; col++) {
    const vs = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([a, b]) => valorEn(w + (col + a) * dx, n - (f + b) * dy)).filter(Boolean);
    if (vs.length) celdas.push({ f, c: col, p: vs.reduce((t, v) => t + v.p, 0) / vs.length, comuna: vs[0].id });
  }
  return { bbox: [w, s, e, n], filas, columnas, celdas };
}
