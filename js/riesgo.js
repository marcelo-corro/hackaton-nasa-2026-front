// Reglas puras de los datos que publica el back (contrato 0.4), sin DOM, para probarlas con node --test.
// El nivel de cada comuna viene en el campo "nivel" de cada archivo: aquí no se recalcula con cortes propios.

export const HORIZONTES = [
  { id: "24", archivo: "riesgo/ultimo.json", nombre: "24 h" },
  { id: "48", archivo: "riesgo/48h.json", nombre: "48 h" },
  { id: "168", archivo: "riesgo/7d.json", nombre: "7 días" },
];
export const horizonteValido = (h) => (HORIZONTES.some((x) => x.id === h) ? h : "24");

export const NIVELES = ["bajo", "medio", "alto", "muy_alto"];
export const NIVEL_TXT = { bajo: "Bajo", medio: "Medio", alto: "Alto", muy_alto: "Muy alto" };
export const NIVEL_COLOR = { bajo: "#c9d6ea", medio: "#f2b36b", alto: "#fc3d21", muy_alto: "#7a1308" };
export const nivelIdx = (n) => Math.max(0, NIVELES.indexOf(n));

/** Respuesta de riesgo/*.json con la forma que usan las vistas. */
export function normalizarRiesgo(r) {
  return {
    ejemplo: !!r.ejemplo, modelo: r.modelo, horizonte: String(r.horizonte_horas),
    periodo: { desde: r.valido_para, hasta: r.valido_hasta ?? r.valido_para },
    orientativo: !!r.orientativo, nota: r.nota ?? null, umbrales: r.umbrales ?? null, metricas: r.metricas ?? null,
    items: r.items.map((i) => ({ region_id: i.region_id, p: i.prob_foco, nivel: i.nivel, percentil: i.percentil })),
  };
}

/** Los dos primeros dígitos del código de comuna son la región. */
export const regionDe = (comunaId) => String(comunaId).slice(0, 2);

/** Regiones con el nivel más alto de sus comunas y cuántas están en alto o muy alto. Orden: más comunas en alto/muy alto, luego nivel y nombre. */
export function agruparRegiones(items, nombres) {
  const por = {};
  for (const it of items) {
    const id = regionDe(it.region_id);
    (por[id] ??= { id, nombre: nombres[it.region_id]?.region ?? "Región " + id, comunas: [] }).comunas.push(it);
  }
  return Object.values(por).map((r) => {
    const maxNivel = Math.max(...r.comunas.map((c) => nivelIdx(c.nivel)));
    return { ...r, nivel: NIVELES[maxNivel], nAltas: r.comunas.filter((c) => nivelIdx(c.nivel) >= 2).length };
  }).sort((a, b) => b.nAltas - a.nAltas || nivelIdx(b.nivel) - nivelIdx(a.nivel) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Clase de color 0 a 4 de un sector según su percentil dentro de la comuna (cortes en 20, 40, 60 y 80). */
export const claseSector = (percentil) => [20, 40, 60, 80].filter((c) => percentil >= c).length;

/** Porcentaje con coma y decimales fijos: 0,00003 con 2 decimales da "0,00 %". */
export const pctTxt = (p, dec = 1) => (p == null ? "sin dato" : (p * 100).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " %");

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const partes = (iso) => { const [a, m, d] = iso.split("-").map(Number); return { a, m: m - 1, d }; };
/** "1 de enero de 2026" o "1 al 7 de enero de 2026". */
export function periodoTxt({ desde, hasta }) {
  const a = partes(desde), b = partes(hasta ?? desde);
  if (desde === (hasta ?? desde)) return `${a.d} de ${MES[a.m]} de ${a.a}`;
  if (a.m === b.m && a.a === b.a) return `${a.d} al ${b.d} de ${MES[a.m]} de ${a.a}`;
  return `${a.d} de ${MES[a.m]} al ${b.d} de ${MES[b.m]} de ${b.a}`;
}

/** Filas de sectores_focos CSV (fecha,lat,lon,frp,focos_incendio,sector_id) como { fecha, lat, lon, frp }. */
export function leerFocosCsv(texto) {
  return texto.trim().split(/\r?\n/).slice(1).map((l) => l.split(",")).filter((c) => c.length >= 4)
    .map((c) => ({ fecha: c[0], lat: Number(c[1]), lon: Number(c[2]), frp: Number(c[3]) }))
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));
}

/** Texto de una recomendación con su enlace: { texto, url, fuente } o null si el código no existe. */
export function recomendacion(rec, codigo) {
  const r = rec?.recomendaciones?.[codigo];
  if (!r) return null;
  const f = rec.fuentes?.[r.fuente];
  return { codigo, texto: r.texto, fuente: f?.nombre ?? null, url: f?.url ?? null };
}
