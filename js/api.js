// Única puerta de entrada a los datos. Las vistas no hacen fetch por su cuenta.
import { CONFIG, URL_BACK } from "./config.js";
import { rutaChile, rutaComuna } from "./prediccion.js";
import { chileSintetico, comunaSintetica, periodoDia } from "./sintetico.js";
import { rutaTriaje } from "./triaje.js";
import { HORIZONTES, normalizarRiesgo, horizonteValido } from "./riesgo.js";

async function leerJSON(url, cache = "no-store") {
  const r = await fetch(url, { cache });
  if (!r.ok) throw new Error(`No se pudo leer ${url} (respuesta ${r.status})`);
  return r.json();
}

let manifestCache = null;

async function manifest() {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = await leerJSON(CONFIG.BASE_CONTRATO + "manifest.json");
  } catch (e) {
    // Sin conexión con el back: se sigue con la copia local y la página lo dice.
    if (CONFIG.BASE_CONTRATO === CONFIG.BASE_MAQUETA) throw e;
    CONFIG.BASE_CONTRATO = CONFIG.BASE_MAQUETA;
    CONFIG.FUENTE = "maqueta";
    CONFIG.SIN_BACK = true;
    manifestCache = await leerJSON(CONFIG.BASE_CONTRATO + "manifest.json");
  }
  return manifestCache;
}

// Las rutas de cada archivo salen del manifest, como pide el contrato.
async function ruta(clave, regionId) {
  const m = await manifest();
  const plantilla = m.archivos[clave];
  return CONFIG.BASE_CONTRATO + (regionId ? plantilla.replace("{region_id}", regionId) : plantilla);
}

// Con solo riesgo/ultimo.json se arma un día: sin humo, sin salud y sin los factores de la extensión.
async function pronosticoDeUnDia() {
  const [riesgo, geo] = await Promise.all([api.riesgo(), api.regiones()]);
  const nombres = Object.fromEntries(geo.features.map((f) => [f.properties.region_id, f.properties]));
  return {
    ejemplo: riesgo.ejemplo,
    calculado_utc: riesgo.calculado_utc,
    un_solo_dia: true,
    nota: "Solo hay riesgo a 24 horas: falta el pronóstico extendido.",
    items: riesgo.items.map((it) => ({
      region_id: it.region_id,
      nombre: nombres[it.region_id]?.nombre ?? it.region_id,
      region: nombres[it.region_id]?.region ?? "",
      dias: [{ fecha: riesgo.valido_para, dia: 1, fuente_foco: "motor", prob_foco: it.prob_foco, nivel: it.nivel,
               confianza: "alta", pm25_humo: null, urgencias_resp_base: null, urgencias_resp_extra_pct: null,
               urgencias_resp_extra: null }],
    })),
  };
}

// ---- Predicción por periodo (producto nuevo) ----
// Se pide primero a BASE_PREDICCION; si falla, a la copia de ejemplo local. Una vez que falla el back, no se vuelve a insistir.
let predBackCaido = !CONFIG.BASE_PREDICCION;
async function leerPrediccion(archivo) {
  if (!predBackCaido) {
    try { return { ...(await leerJSON(CONFIG.BASE_PREDICCION + archivo)), origen: "back" }; } catch { predBackCaido = true; CONFIG.SIN_PREDICCION = true; }
  }
  return { ...(await leerJSON(CONFIG.BASE_EXT + archivo)), origen: "ejemplo" };
}

// ---- Sala de triaje: se pide a BASE_TRIAJE y, si falla, a la copia de ejemplo local, sin error visible ----
let triajeBackCaido = !CONFIG.BASE_TRIAJE;
async function leerTriaje(fecha) {
  const archivo = rutaTriaje(fecha);
  if (!triajeBackCaido) {
    try { return { ...(await leerJSON(CONFIG.BASE_TRIAJE + archivo)), origen: "back" }; } catch { triajeBackCaido = true; }
  }
  return { ...(await leerJSON(CONFIG.BASE_EXT + archivo)), origen: "ejemplo" };
}

// ---- Riesgo de un día: se pide al back y, si no lo publica, se calcula sintético en el navegador (sintetico.js) ----
async function leerRiesgoBack(archivo) {
  if (predBackCaido) return null;
  try { return { ...(await leerJSON(CONFIG.BASE_PREDICCION + archivo)), origen: "back" }; } catch { predBackCaido = true; CONFIG.SIN_PREDICCION = true; return null; }
}

// ---- Back real (contrato 0.4): sin respaldo inventado. Si el back no responde, el error llega a la pantalla. ----
const cacheBack = new Map();
const unaVez = (clave, f) => { if (!cacheBack.has(clave)) cacheBack.set(clave, f().catch((e) => { cacheBack.delete(clave); throw e; })); return cacheBack.get(clave); };
export const back = {
  manifest: () => unaVez("manifest", () => leerJSON(URL_BACK + "manifest.json")),
  riesgo: (h = "24") => { const hh = horizonteValido(h); return unaVez("riesgo" + hh, async () => normalizarRiesgo(await leerJSON(URL_BACK + HORIZONTES.find((x) => x.id === hh).archivo))); },
  alertas: (codigoRegion = "05") => unaVez("alertas" + codigoRegion, () => leerJSON(URL_BACK + `alertas/${codigoRegion}.json`)),
  sectores: (id) => unaVez("sectores" + id, () => leerJSON(URL_BACK + `sectores/${id}.geojson`, "default")),
  recomendaciones: () => unaVez("recomendaciones", () => leerJSON(URL_BACK + "recomendaciones.json", "default")),
  // Métricas del modelo a 24 h en la prueba (los archivos de 48 h y 7 días traen las suyas dentro).
  metricas: () => unaVez("metricas", () => leerJSON(URL_BACK + "metricas.json")),
  // Contrato 0.7: incendios activos con zona probable de avance. Es una capa extra: si el manifest no la trae o el
  // archivo falla, devuelve null y la plataforma sigue sin ella (no se reintenta hasta recargar la página).
  avance: () => unaVez("avance", async () => {
    try {
      const archivo = (await back.manifest()).archivos?.avance;
      return archivo ? await leerJSON(URL_BACK + archivo) : null;
    } catch (e) { console.warn("Sin incendios activos del back:", e.message); return null; }
  }),
  // Contrato 0.8: riesgo, clima del último día, motivos y recomendaciones de las 345 comunas. Si el back no lo publica,
  // devuelve null y las vistas usan el bloque `comunas` de alertas/{región}.json (solo el piloto de Valparaíso).
  comunas: () => unaVez("comunas", async () => {
    try {
      const archivo = (await back.manifest()).archivos?.comunas;
      if (!archivo) return null;
      const d = await leerJSON(URL_BACK + archivo);
      return { ...d, porId: new Map(d.comunas.map((c) => [c.region_id, c])) };
    } catch (e) { console.warn("Sin comunas.json del back:", e.message); return null; }
  }),
  focosSector: (id) => unaVez("focos" + id, async () => {
    const r = await fetch(URL_BACK + `sectores/${id}_focos.csv`, { cache: "default" });
    if (!r.ok) throw new Error(`No hay focos para ${id} (respuesta ${r.status})`);
    return r.text();
  }),
};

export const api = {
  triaje: leerTriaje,
  riesgoChileDia: async (dia) => (await leerRiesgoBack(`prediccion-chile-${dia}.json`)) ?? { ...chileSintetico(await api.contornos(), periodoDia(dia)), origen: "sintetico" },
  // `base` trae el contorno de la comuna y su riesgo en el mapa de Chile ({ feature, p, periodo }) para armar el respaldo sintético.
  riesgoComunaDia: async (codigo, dia, base = {}) => (await leerRiesgoBack(`prediccion-comuna-${codigo}-${dia}.json`))
    ?? (base.feature ? { ...comunaSintetica(base.feature, periodoDia(dia), base), origen: "sintetico" } : null),
  // Orden en los dos casos: back, copia de ejemplo local y, si no hay nada, datos sintéticos calculados en el navegador (sintetico.js).
  prediccionChile: async (rango) => {
    try { return await leerPrediccion(rutaChile(rango)); } catch { /* sigue con lo sintético */ }
    return { ...chileSintetico(await api.contornos(), rango), origen: "sintetico" };
  },
  // `base` trae el contorno de la comuna y su riesgo en el mapa de Chile ({ feature, p, periodo }) para armar el respaldo sintético.
  prediccionComuna: async (codigo, rango, base = {}) => {
    try { return await leerPrediccion(rutaComuna(codigo, rango)); } catch { /* sigue con lo sintético */ }
    return base.feature ? { ...comunaSintetica(base.feature, rango, base), origen: "sintetico" } : null;
  },
  // Contornos de las 345 comunas: los del back; si no responde, la copia liviana local.
  contornos: async () => {
    try { return await leerJSON(URL_BACK + "regiones.geojson", "default"); } catch { /* sigue con la copia local */ }
    return leerJSON(CONFIG.BASE_EXT + "contornos-chile.geojson", "default");
  },

  // ---- Contrato 0.2 (back: https://marcelo-corro.github.io/aivital-incendios-datos) ----
  manifest,
  // Los contornos reales pesan 2 MB: se dejan en la caché del navegador.
  regiones: async () => leerJSON(await ruta("regiones"), "default"),
  riesgo: async () => leerJSON(await ruta("riesgo")),
  calendario: async (regionId) => leerJSON(await ruta("calendario", regionId)),
  urlFocos: (regionId) => ruta("focos", regionId),
  // El CSV se pide como texto: el atributo download no funciona entre dominios distintos.
  focosCsv: async (regionId) => {
    const r = await fetch(await ruta("focos", regionId), { cache: "no-store" });
    if (!r.ok) throw new Error(`No hay focos para ${regionId} (respuesta ${r.status})`);
    return r.text();
  },
  metricas: async () => leerJSON(await ruta("metricas")),

  // ---- Extensión propuesta (no está en el contrato 0.2) ----
  // Orden: riesgo real del back si existe (un día). Si viene vacío, el pronóstico inventado de la maqueta, marcado.
  pronostico: async () => {
    await manifest();
    if (CONFIG.FUENTE !== "maqueta") {
      const riesgo = await api.riesgo().catch(() => ({ items: [] }));
      if (riesgo.items?.length) return pronosticoDeUnDia();
      return { ...(await leerJSON(CONFIG.BASE_EXT + "pronostico.json")), inventado: true, back_sin_riesgo: true };
    }
    try { return { ...(await leerJSON(CONFIG.BASE_EXT + "pronostico.json")), inventado: true }; } catch { return pronosticoDeUnDia(); }
  },
  contraste: async () => { try { return await leerJSON(CONFIG.BASE_EXT + "contraste.json"); } catch { return null; } },

  // ---- Del cliente (en la maqueta, de ejemplo) ----
  puntos: () => leerJSON(CONFIG.BASE_EXT + "puntos.json"),
  protocolos: () => leerJSON(CONFIG.BASE_EXT + "protocolos.json"),
  registro: () => leerJSON(CONFIG.BASE_EXT + "registro.json"),
};
