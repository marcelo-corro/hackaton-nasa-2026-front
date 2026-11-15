// Respaldo sintético: cuando ni el back ni la copia de ejemplo tienen datos, la predicción se inventa aquí, en el navegador.
// Sale de los contornos de la comuna y de una semilla fija por comuna: la misma comuna da siempre los mismos números.
// Ningún número sale del modelo. Todo lleva "ejemplo": true y la pantalla lo avisa. Misma fórmula que scripts/generar_prediccion.py.
import { rangoValido } from "./prediccion.js";

const ESTACION = [1.0, 1.2, 0.9, 0.5, 0.2, 0.1, 0.05, 0.1, 0.2, 0.4, 0.6, 0.9];   // peso de cada mes del año
// id, nombre, modificable por el municipio, peso base
const CAUSAS = [
  ["pasto", "Pasto y vegetación seca (combustible)", true, 22],
  ["interfaz", "Viviendas pegadas a la vegetación (interfaz)", true, 8],
  ["basurales", "Basurales y escombros", true, 6],
  ["quemas", "Quemas agrícolas y de residuos", true, 9],
  ["temperatura", "Temperatura", false, 14],
  ["sequia", "Sequía (déficit de lluvia y humedad)", false, 13],
  ["viento", "Viento", false, 10],
  ["caminos", "Cercanía a caminos y población", false, 10],
  ["relieve", "Relieve (pendiente)", false, 8],
];
// id, nombre, causa que reduce, eficacia, costo CLP por hectárea tratada, fracción del suelo que se trata
const ACCIONES = [
  ["cortafuegos", "Cortafuegos y limpieza de pasto en los bordes", "pasto", 0.55, 900_000, 0.00024],
  ["faja", "Faja de seguridad entre viviendas y vegetación", "interfaz", 0.60, 1_400_000, 0.00008],
  ["basurales", "Limpieza de basurales y escombros", "basurales", 0.70, 2_200_000, 0.00003],
  ["quemas", "Fiscalización de quemas y campañas de aviso", "quemas", 0.45, 350_000, 0.0004],
];
const SUPUESTOS = { vsl_clp: 1_500_000_000, valor_propiedad_ha_clp: 15_000_000, costo_combate_ha_clp: 2_500_000 };
const MODELO = "sintético (números inventados en el navegador, no del modelo)";

/** Generador de números al azar con semilla de texto: repetible entre visitas y entre equipos. */
export function azar(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) { h = Math.imul(h ^ texto.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  let s = (h ^ (h >>> 16)) >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, entre: (a, b) => a + (b - a) * u(), gauss: () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) };
}

// Un día suelto: periodo de un solo día. La tasa diaria se calibra para que la suma del riesgo de las 345 comunas
// de un día de enero calce con unos 65 incendios, que es lo que registra CONAF en un día punta (67 el 17 de enero de 2026).
export const periodoDia = (dia) => ({ desde: dia, hasta: dia });
const esDia = (periodo) => periodo.desde === periodo.hasta;
const TASA_DIA = 0.045 * 9;
const resolver = (rango, hoy) => (typeof rango === "string" ? periodoDe(rango, hoy) : rango);
const claveDe = (rango, periodo) => (typeof rango === "string" ? rangoValido(rango) : periodo.desde);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Fechas de cada rango contadas desde hoy. */
export function periodoDe(rango, hoy = new Date()) {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [desde, hasta] = {
    "esta-semana": [h, mas(h, 6)],
    "proxima-semana": [mas(h, 7), mas(h, 13)],
    "dentro-2-semanas": [mas(h, 14), mas(h, 20)],
    "este-mes": [h, new Date(h.getFullYear(), h.getMonth() + 1, 0)],
    "proximo-mes": [new Date(h.getFullYear(), h.getMonth() + 1, 1), new Date(h.getFullYear(), h.getMonth() + 2, 0)],
  }[rangoValido(rango)];
  return { desde: iso(desde), hasta: iso(hasta) };
}

function factorPeriodo(periodo) {
  const d0 = new Date(periodo.desde + "T12:00:00"), d1 = new Date(periodo.hasta + "T12:00:00");
  const dias = Math.round((d1 - d0) / 864e5) + 1;
  let suma = 0;
  for (let i = 0; i < dias; i++) suma += ESTACION[mas(d0, i).getMonth()];
  return { f: suma / dias, dias, mes: d0.getMonth() + 1 };
}

export function enPoligono(x, y, anillos) {
  const dentro = (a) => {
    let c = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i], [xj, yj] = a[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  return dentro(anillos[0]) && !anillos.slice(1).some(dentro);
}

/** Medidas de la comuna a partir de su contorno, más su sesgo de riesgo y población inventados con semilla. */
function comunaDe(feature, periodo = null) {
  const g = feature.geometry, id = feature.properties.region_id;
  const polis = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, area = 0;
  for (const pol of polis) {
    const a = pol[0];
    let lat = 0, sh = 0;
    for (let i = 0; i < a.length; i++) {
      const [x, y] = a[i], [x2, y2] = a[(i + 1) % a.length];
      if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
      lat += y; sh += x * y2 - x2 * y;
    }
    area += (Math.abs(sh) / 2) * Math.cos(((lat / a.length) * Math.PI) / 180) * 111 * 111;
  }
  const r = azar("comuna-" + id), lat = (s + n) / 2;
  // El riesgo inventado se concentra entre Valparaíso y el Biobío, donde ocurre la mayoría de los incendios.
  const zona = Math.exp(-(((lat + 35.5) / 4.2) ** 2));
  // En un día suelto el riesgo de cada comuna varía de un día a otro (clima, viento), con semilla por comuna y día.
  const dia = periodo && esDia(periodo) ? azar(`dia-${id}-${periodo.desde}`).entre(0.7, 1.35) : 1;
  const sesgo = Math.min(1, (0.06 + 0.9 * zona * r.entre(0.55, 1.15)) * dia);
  const pob = Math.round(4000 * Math.exp(r.gauss() * 1.3) * (r.u() < 0.08 ? 4 : 1));
  return { id, nombre: feature.properties.nombre, region: feature.properties.region, polis, bbox: [w, s, e, n], lat, area: Math.max(area, 1), sesgo, pob };
}

function probComuna(c, periodo) {
  const { f, dias } = factorPeriodo(periodo);
  return Math.min(0.97, 1 - Math.exp(-(esDia(periodo) ? TASA_DIA : 0.045) * c.sesgo * (c.area / 400) ** 0.35 * f * dias));
}

/** Reparte en porcentajes que suman 100 con un decimal: el resto del redondeo va al mayor. */
function reparto(pesos) {
  const s = pesos.reduce((a, b) => a + b, 0);
  const r = pesos.map((p) => Math.round((p / s) * 1000) / 10);
  const i = r.indexOf(Math.max(...r));
  r[i] = Math.round((r[i] + 100 - r.reduce((a, b) => a + b, 0)) * 10) / 10;
  return r;
}

function recomendaciones(p, pct, areaHa) {
  const ids = CAUSAS.map((c) => c[0]);
  return ACCIONES.map(([, , causa, efic, costoHa, fr]) => {
    const parte = pct[ids.indexOf(causa)] / 100;
    return [Math.round(p * 100 * parte * efic * 100) / 100, Math.round((areaHa * fr * (0.5 + parte * 2) * costoHa) / 1000) * 1000];
  });
}

const r1 = (v) => Math.round(v * 10) / 10;
const tramoHa = (ha) => [r1(ha * 0.25), r1(ha), r1(ha * 3.2)];

/** Riesgo inventado de todas las comunas para un rango. Se usa si no hay ni back ni copia de ejemplo. */
export function chileSintetico(contornos, rango, hoy = new Date()) {
  const periodo = resolver(rango, hoy);
  return {
    contrato: "prediccion-1.0", ejemplo: true, sintetico: true, modelo: MODELO, rango: claveDe(rango, periodo), periodo,
    items: contornos.features.map((f) => {
      const c = comunaDe(f, periodo);
      return { region_id: c.id, p: Math.round(probComuna(c, periodo) * 1000) / 1000, ha: r1(4 * (c.area / 400) ** 0.2), detalle: true };
    }),
  };
}

/**
 * Detalle inventado de una comuna (grilla, tamaño, causas y recomendaciones) con la forma del contrato.
 * `base.p` y `base.periodo` vienen del mapa de Chile para que el detalle calce con el color de la comuna.
 */
export function comunaSintetica(feature, rango, base = {}, hoy = new Date()) {
  const periodo = base.periodo ?? resolver(rango, hoy);
  const c = comunaDe(feature, periodo);
  const p = Math.min(0.97, Math.max(0.001, base.p ?? probComuna(c, periodo)));
  const { mes } = factorPeriodo(periodo);
  const [w, s, e, n] = c.bbox;

  // Causas: peso base con variación propia de la comuna; en diciembre pesan más la temperatura y la sequía.
  const rc = azar("causas-" + c.id), rd = azar(`datos-${c.id}-${claveDe(rango, periodo)}`);
  const pesos = CAUSAS.map(([id, , , b]) => b * Math.exp(rc.gauss() * 0.35) * (id === "pasto" && c.sesgo > 0.6 ? 1.3 : 1));
  if (mes === 12) { pesos[4] *= 1.25; pesos[5] *= 1.2; }
  const pesosR = pesos.map((x) => x * rd.entre(0.95, 1.05));
  const pct = reparto(pesosR);
  const por = Object.fromEntries(CAUSAS.map(([id], i) => [id, pct[i]]));
  const ha = 5 * (0.5 + por.pasto / 22) * (0.6 + por.viento / 10) * (0.6 + por.relieve / 8) * (c.area / 400) ** 0.2;
  const expuestos = Math.round((c.pob * por.interfaz) / 100 * 3);

  // Grilla de 8 a 12 celdas por lado según el tamaño; solo las celdas que tocan la comuna.
  const k = Math.cos((c.lat * Math.PI) / 180), ancho = (e - w) * k, alto = n - s;
  const lado = c.area < 150 ? 8 : c.area < 700 ? 10 : 12;
  const [columnas, filas] = ancho >= alto ? [lado, Math.max(5, Math.round((lado * alto) / ancho))] : [Math.max(5, Math.round((lado * ancho) / alto)), lado];
  const dx = (e - w) / columnas, dy = (n - s) / filas;
  const dentro = [];
  for (let f = 0; f < filas; f++) for (let col = 0; col < columnas; col++) {
    const x0 = w + col * dx, y1 = n - f * dy;
    const toca = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].some(([a, b]) => c.polis.some((pol) => enPoligono(x0 + dx * a, y1 - dy * b, pol)));
    if (toca) dentro.push({ f, c: col, x: x0 + dx / 2, y: y1 - dy / 2 });
  }
  if (!dentro.length) dentro.push({ f: 0, c: 0, x: w + dx / 2, y: n - dy / 2 });

  // Dos o tres zonas donde se concentra el riesgo, fijas por comuna (no cambian con el rango).
  const rf = azar("focos-" + c.id);
  const focos = Array.from({ length: rf.u() < 0.5 ? 2 : 3 }, () => [rf.entre(w, e), rf.entre(s, n), rf.entre(0.08, 0.22) * Math.max(e - w, n - s), rf.entre(0.6, 1.4)]);
  const peso = dentro.map(({ x, y }) => focos.reduce((v, [fx, fy, sg, a]) => v + a * Math.exp(-(((x - fx) / sg) ** 2 + ((y - fy) / sg) ** 2) / 2), 0.08 + rf.entre(0, 0.06)));
  const total = peso.reduce((a, b) => a + b, 0), nCeldas = dentro.length, lam = -Math.log(1 - p);
  const areaCeldaHa = (c.area * 100) / (filas * columnas);

  const celdas = dentro.map((d, i) => {
    const rel = (peso[i] / total) * nCeldas, pc = 1 - Math.exp((-lam * peso[i]) / total);
    const rcel = azar(`celda-${c.id}-${d.f}-${d.c}`);
    const ca = reparto(pesosR.map((x, j) => x * rcel.entre(0.6, 1.5) * (CAUSAS[j][0] === "pasto" ? 1 + 0.5 * (rel - 1) : 1)));
    return { f: d.f, c: d.c, p: Math.round(pc * 10000) / 10000, ha: tramoHa(ha * Math.sqrt(rel)), ex: Math.round((expuestos / nCeldas) * (0.5 + rcel.u())), ca, rc: recomendaciones(pc, ca, areaCeldaHa) };
  });

  return {
    contrato: "prediccion-1.0", ejemplo: true, sintetico: true, modelo: MODELO, rango: claveDe(rango, periodo), periodo,
    comuna: { region_id: c.id, nombre: c.nombre, region: c.region },
    catalogo: {
      causas: CAUSAS.map(([id, nombre, modificable]) => ({ id, nombre, modificable })),
      acciones: ACCIONES.map(([id, nombre, causa]) => ({ id, nombre, causa })),
    },
    resumen: {
      prob: Math.round(p * 1000) / 1000, ha: tramoHa(ha), personas_expuestas: expuestos, vidas_si_incendio: Math.round(expuestos * 1e-5 * 10000) / 10000,
      causas: CAUSAS.map(([id], i) => ({ id, pct: pct[i] })),
      recomendaciones: recomendaciones(p, pct, c.area * 100).map(([reduccion_pp, costo_clp], i) => ({ accion: ACCIONES[i][0], reduccion_pp, costo_clp })),
    },
    supuestos_sugeridos: SUPUESTOS,
    grilla: { bbox: [w, s, e, n].map((v) => Math.round(v * 10000) / 10000), filas, columnas, celdas },
  };
}
