// Genera app/lib/comunas-indice.json: las 345 comunas con nombre, región, slug y caja de límites.
// La geografía casi no cambia, así que el índice se guarda en el repo: el buscador y el mapa lo usan sin
// esperar a descargar regiones.geojson (2 MB). Correr con: npm run indice
import { writeFile } from "node:fs/promises";

const URL_DATOS = process.env.VITE_URL_DATOS ?? "https://marcelo-corro.github.io/hackaton-nasa-2026-datos/";
const SALIDA = new URL("../app/lib/comunas-indice.json", import.meta.url);

// Orden de norte a sur por código de región.
const ORDEN_REGIONES = ["15", "01", "02", "03", "04", "05", "13", "06", "07", "16", "08", "09", "14", "10", "11", "12"];

const slug = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function caja(geom) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const recorrer = (c) => {
    if (typeof c[0] === "number") {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(recorrer);
  };
  recorrer(geom.coordinates);
  return [w, s, e, n].map((v) => Math.round(v * 1000) / 1000);
}

const resp = await fetch(new URL("regiones.geojson", URL_DATOS));
if (!resp.ok) throw new Error(`No se pudo leer regiones.geojson: ${resp.status}`);
const geo = await resp.json();

const comunas = geo.features.map((f) => {
  const { region_id, nombre, region } = f.properties;
  return { id: region_id, nombre, slug: slug(nombre), region, codigoRegion: region_id.slice(0, 2), caja: caja(f.geometry) };
});

const slugs = new Set(comunas.map((c) => c.slug));
if (slugs.size !== comunas.length) throw new Error("Hay comunas con el mismo slug");
if (comunas.length !== 345) console.warn(`Ojo: ${comunas.length} comunas (se esperaban 345)`);

comunas.sort((a, b) => {
  const r = ORDEN_REGIONES.indexOf(a.codigoRegion) - ORDEN_REGIONES.indexOf(b.codigoRegion);
  return r !== 0 ? r : (a.caja[1] + a.caja[3]) / 2 > (b.caja[1] + b.caja[3]) / 2 ? -1 : 1;
});

await writeFile(SALIDA, JSON.stringify(comunas) + "\n", "utf8");
console.log(`Índice: ${comunas.length} comunas → ${SALIDA.pathname}`);
