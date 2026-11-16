// Dónde lee los datos el front.
//   fuente "back":    contornos, calendario, focos y métricas salen de la URL pública del back (datos reales, 345 comunas).
//                     Si el back no publica riesgo, el pronóstico sale de la maqueta y la página lo avisa.
//   fuente "maqueta": todo sale de web/datos (inventado, 26 comunas). Sirve sin internet.
// Se elige con el interruptor del pie de página, con ?fuente=maqueta, o con ?base= para probar otra ruta del contrato.
const q = new URLSearchParams(location.search);
const guardado = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };

export const URL_BACK = "https://marcelo-corro.github.io/hackaton-nasa-2026-datos/";
const fuente = q.get("fuente") || guardado("preaviso.fuente") || "back";
// En el teléfono la app trae la página dentro y pide los datos de ejemplo a un servidor: se guarda en los ajustes de la app.
// La app de Android se compila con la dirección del servidor de la organización aquí (scripts/compilar_apk.sh).
const SERVIDOR_DE_FABRICA = "";
const servidor = (q.get("servidor") || guardado("preaviso.servidor") || SERVIDOR_DE_FABRICA).replace(/\/?$/, "/").replace(/^\/$/, "");

export const CONFIG = {
  FUENTE: q.get("base") ? "otra" : fuente,
  SERVIDOR: servidor,
  // Archivos del contrato 0.2 que publica el back (manifest.json, regiones.geojson, calendario, focos, riesgo, métricas).
  BASE_CONTRATO: q.get("base") || (fuente === "back" ? URL_BACK : servidor + "datos/"),
  // Copia local del contrato con datos inventados. Es el respaldo si el back no responde.
  BASE_MAQUETA: servidor + "datos/",
  // Extensión propuesta, fuera del contrato: pronóstico de cinco días, contraste, puntos, protocolos y registro. Hoy inventados.
  BASE_EXT: q.get("ext") || servidor + "datos/ext/",
  // Predicción por periodo (riesgo de Chile y detalle de comuna). El back todavía no la publica: si no responde,
  // se usa la copia de ejemplo de BASE_EXT. Se puede apuntar a otra ruta con ?pred=https://.../ (contrato en datos/ext/CONTRATO.md).
  BASE_PREDICCION: q.get("pred") || (fuente === "maqueta" ? "" : URL_BACK + "prediccion/"),
  // Sala de triaje: un archivo por día (triaje-AAAA-MM-DD.json). El back todavía no lo publica: si no responde, se usa la copia de ejemplo de BASE_EXT.
  BASE_TRIAJE: q.get("triaje") || (fuente === "maqueta" ? "" : URL_BACK + "triaje/"),
  // Mapa base. Se pide desde el navegador de quien mira la app.
  // Imagen satelital en color real (Esri World Imagery) y, encima, nombres de lugares y límites.
  TESELAS: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  TESELAS_NOMBRES: "",
  TESELAS_CREDITO: 'Mapa base &copy; Esri, HERE, Garmin, OpenStreetMap',
  // Vista inicial del mapa: zona central, donde parte la semana de la maqueta.
  MAPA_CENTRO: [-33.55, -71.45],
  MAPA_ZOOM: 8.5,
};
