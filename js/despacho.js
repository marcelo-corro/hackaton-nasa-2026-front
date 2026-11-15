// Sala de despacho (portada) con los datos reales del back (contrato 0.7): una sola pantalla con el diseño de David.
// Prioridades a la izquierda del mapa (fuego activo del satélite y comunas con más riesgo), mapa al centro, tarjeta flotante
// y tablero con el acierto real del modelo. Horizontes de 24 h, 48 h y 7 días, como en plataforma.html.
// La zona probable de avance son dos círculos validados (no un cono) y se muestra en 24 h, porque vale para el día siguiente.
// Los incendios de ejemplo de enero (CONAF) siguen en plataforma.html, en el modo visión.
import { api, back } from "./api.js";
import { HORIZONTES, horizonteValido, NIVELES, NIVEL_TXT, NIVEL_COLOR, nivelIdx, regionDe, periodoTxt, recomendacion } from "./riesgo.js";
import { nombreCorto, esContinental } from "./region.js";
import { $, esc, dec, fFecha } from "./util.js";

const TESELAS_MAPA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MORADO = "#5b2a86";   // incendio activo: el mismo morado de plataforma.html y de "Fuego activo" en las alertas
const ORDEN_REG = ["15", "01", "02", "03", "04", "05", "13", "06", "07", "16", "08", "09", "14", "10", "11", "12"];   // de norte a sur
const LIMITES_CHILE = [[-55.9, -75.7], [-17.5, -66.4]];
const N_COMUNAS = 15, N_FUEGOS = 8;   // largo de cada grupo de la lista (los incendios se pueden desplegar todos)
const TIPO_ETQ = { fuego_activo: "Fuego activo cerca", alerta: "Alerta", vigilancia: "Vigilancia" };
const ZOOM_SECTORES = 10;   // los sectores de 1 km se dibujan desde este acercamiento: más lejos se tapan entre sí y tapan los incendios
const PUNTOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];

const S = { h: "24", region: "", sel: null, todos: false };   // sel: { tipo: "fuego" | "comuna" | "sector", id }
const D = { r: {}, man: null, metricas: null, activos: null, contornos: null, nombres: {}, alertas: null, rec: null, comunas: null };
let mapa, capaComunas, capaZonas, capaPuntos, capaSectores, capasComuna = {};

const pct = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const fCorta = (iso) => fFecha(iso, { day: "numeric", month: "short" });
const fLarga = (iso) => fFecha(iso, { day: "numeric", month: "long" });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const rumbo = (g) => PUNTOS[Math.round((((Number(g) % 360) + 360) % 360) / 45) % 8];
const coord = (x) => `${Math.abs(x.lat).toFixed(3)}° S · ${Math.abs(x.lon).toFixed(3)}° O`;
const hNombre = () => HORIZONTES.find((x) => x.id === S.h).nombre;
const riesgo = () => D.r[S.h];
const riesgoDe = (id) => riesgo()?.items.find((i) => i.region_id === id);
const enZona = (id) => !S.region || regionDe(id) === S.region;
const zonaTxt = () => (S.region ? nombreCorto(regionNombre(S.region)) : "Chile");
const regionNombre = (reg) => Object.values(D.nombres).find((f) => regionDe(f.region_id) === reg)?.region ?? "Región " + reg;
const conCirculos = () => S.h === "24";   // la zona de avance está validada para el día siguiente
const chipNivel = (n) => `<span class="niv niv-${esc(n)}">${esc(NIVEL_TXT[n] ?? "sin dato")}</span>`;
const urlPlataforma = (id, sector = null) => `plataforma.html#comuna=${encodeURIComponent(id)}${sector ? "&sector=" + encodeURIComponent(sector) : ""}${S.h !== "24" ? "&h=" + S.h : ""}`;
/** Sectores de 1 km de la lista de alertas del horizonte (piloto de Valparaíso), en el orden del back. */
const sectoresLista = () => D.alertas?.horizontes?.[S.h] ?? [];
const chipTipo = (t) => `<span class="marca-sec tipo-${esc(t)}">${esc(TIPO_ETQ[t] ?? t)}</span>`;

/** Incendios activos de la zona elegida, los más recientes primero. */
const fuegos = () => (D.activos?.incendios ?? []).filter((x) => enZona(x.region_id))
  .sort((a, b) => b.ultimo_foco.localeCompare(a.ultimo_foco) || b.focos_ultimo_dia - a.focos_ultimo_dia);
/** Comunas de la zona con más probabilidad de foco en el horizonte elegido. */
const comunasTop = () => [...(riesgo()?.items ?? [])].filter((i) => enZona(i.region_id)).sort((a, b) => b.p - a.p).slice(0, N_COMUNAS);

function textoViento(v) {
  if (!v) return "Sin dato de viento.";
  return `Viento del ${fLarga(v.fecha)} (último dato de NASA POWER): viene del ${rumbo(v.desde_grados)} y va hacia el ${rumbo(v.hacia_grados)}, ${dec(v.velocidad_ms * 3.6, 0)} km/h (${v.fuerte ? "fuerte" : "suave"}).`;
}

/* ---------- dirección de la página: horizonte y región, para poder compartirla ---------- */
function leerHash() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ""));
  S.h = horizonteValido(q.get("h"));
  S.region = /^\d{2}$/.test(q.get("region") ?? "") ? q.get("region") : "";
}
function fijarHash() {
  const q = new URLSearchParams();
  if (S.h !== "24") q.set("h", S.h);
  if (S.region) q.set("region", S.region);
  history.replaceState(null, "", q.toString() ? "#" + q : location.pathname + location.search);
}

/* ---------- barra ---------- */
function pintarBarra() {
  $("#horizontes").innerHTML = HORIZONTES.map((x) => `<button type="button" role="radio" aria-checked="${x.id === S.h}" data-h="${x.id}">${esc(x.nombre)}</button>`).join("");
  const regs = [...new Set(Object.keys(D.nombres).map(regionDe))].sort((a, b) => (ORDEN_REG.indexOf(a) + 1 || 99) - (ORDEN_REG.indexOf(b) + 1 || 99));
  $("#region").innerHTML = `<option value="">Todo Chile</option>` + regs.map((id) => `<option value="${esc(id)}"${id === S.region ? " selected" : ""}>${esc(nombreCorto(regionNombre(id)))}</option>`).join("");
  const r = riesgo();
  $("#periodo").innerHTML = r ? `Riesgo para el <b>${esc(periodoTxt(r.periodo))}</b>` : "";
  $("#sello").hidden = !r?.orientativo;
}

/* ---------- prioridades: fuego activo y comunas con más riesgo ---------- */
function filaFuego(x, n) {
  return `<li><button type="button" class="fila fuego" data-sel="fuego:${esc(x.id)}" aria-pressed="${S.sel?.id === x.id}">
    <span class="prio">${n}</span>
    <span class="que"><strong>${esc(x.comuna)}</strong><small>${S.region ? "" : esc(nombreCorto(x.region)) + " · "}desde el ${esc(fCorta(x.inicio))} · ${plural(x.focos_ultimo_dia, "foco", "focos")} el último día</small></span>
    <span class="prob">${x.mostrar_flecha ? `<span class="chip-viento">viento fuerte</span>` : ""}</span></button></li>`;
}
function filaComuna(i, n) {
  const nom = D.nombres[i.region_id];
  return `<li><button type="button" class="fila" data-sel="comuna:${esc(i.region_id)}" aria-pressed="${S.sel?.id === i.region_id}">
    <span class="prio">${n}</span>
    <span class="que"><strong>${esc(nom?.nombre ?? i.region_id)}</strong><small>${S.region ? "" : esc(nombreCorto(nom?.region)) + " · "}${esc(hNombre())}</small></span>
    <span class="prob"><b>${pct(i.p)}</b>${chipNivel(i.nivel)}</span></button></li>`;
}
function pintarCola() {
  const fs = fuegos(), cs = comunasTop(), hasta = D.activos?.ultimo_dato ? fLarga(D.activos.ultimo_dato) : "";
  $("#cola-t").textContent = `Prioridades · ${zonaTxt()} · ${hNombre()}`;
  $("#btn-cola-n").textContent = D.activos ? `· ${plural(fs.length, "incendio activo", "incendios activos")}` : "";
  const vacioFuego = !D.activos?.incendios?.length ? "Sin incendios activos detectados en los últimos 3 días." : `Sin incendios activos en ${esc(zonaTxt())} en los últimos 3 días (hasta el ${esc(hasta)}).`;
  const fuego = !D.activos ? "" : `<li class="grupo-t">Fuego activo · satélite, hasta el ${esc(hasta)} <b>${fs.length}</b></li>`
    + (fs.length ? (S.todos ? fs : fs.slice(0, N_FUEGOS)).map((x, k) => filaFuego(x, k + 1)).join("")
      + (fs.length > N_FUEGOS ? `<li><button type="button" class="ver-mas" data-todos>${S.todos ? "Ver menos" : `Ver los ${fs.length} incendios`}</button></li>` : "")
      : `<li class="vacio">${vacioFuego}</li>`);
  const comunas = `<li class="grupo-t">Comunas con más riesgo · ${esc(hNombre())}</li>`
    + (cs.length ? cs.map((i, k) => filaComuna(i, k + 1)).join("") : `<li class="vacio">Sin datos de riesgo para esta zona.</li>`);
  $("#lista").innerHTML = fuego + comunas;
}

/* ---------- mapa ---------- */
function crearMapa() {
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true, zoomControl: false });
  L.control.zoom({ position: "bottomleft", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(mapa);
  L.tileLayer(TESELAS_MAPA, { attribution: "&copy; colaboradores de OpenStreetMap", maxZoom: 17 }).addTo(mapa);
  mapa.fitBounds(LIMITES_CHILE);
  capaComunas = L.layerGroup().addTo(mapa);
  capaZonas = L.layerGroup().addTo(mapa);
  capaPuntos = L.layerGroup().addTo(mapa);
  capaSectores = L.layerGroup();
  mapa.on("move zoom resize", posicionarTarjeta);
  mapa.on("zoomend", verSectores);
  mapa.on("click", () => { if (S.sel) cerrar(); });
}
const estiloComuna = (nivel, sel) => ({ color: sel ? "#0a1b44" : "#ffffff", weight: sel ? 2.5 : 0.6, opacity: 0.95,
  fillColor: NIVEL_COLOR[nivel] ?? NIVEL_COLOR.bajo, fillOpacity: nivel === "bajo" ? 0.28 : 0.62 });
/** Las 345 comunas con el color de su nivel en el horizonte elegido. Siempre se pintan antes que los incendios para quedar debajo. */
function pintarComunas() {
  capaComunas.clearLayers(); capasComuna = {};
  const pc = Object.fromEntries((riesgo()?.items ?? []).map((i) => [i.region_id, i]));
  L.geoJSON(D.contornos, {
    filter: (f) => pc[f.properties.region_id] != null,
    style: (f) => estiloComuna(pc[f.properties.region_id].nivel, S.sel?.tipo === "comuna" && S.sel.id === f.properties.region_id),
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = pc[id];
      capasComuna[id] = capa;
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong> · ${pct(it.p)} · riesgo ${esc(NIVEL_TXT[it.nivel].toLowerCase())} (${esc(hNombre())})`, { sticky: true });
      capa.on("click", (e) => { L.DomEvent.stopPropagation(e); elegir("comuna", id, false); });
    },
  }).addTo(capaComunas);
}
function marcarComunas() {
  const pc = Object.fromEntries((riesgo()?.items ?? []).map((i) => [i.region_id, i]));
  for (const [id, capa] of Object.entries(capasComuna)) capa.setStyle(estiloComuna(pc[id]?.nivel, S.sel?.tipo === "comuna" && S.sel.id === id));
  if (S.sel?.tipo === "comuna") capasComuna[S.sel.id]?.bringToFront();
}
const iconoViento = (grados) => L.divIcon({ className: "mk-viento", iconSize: [60, 60], iconAnchor: [30, 30],
  html: `<span style="transform:rotate(${Number(grados)}deg)"><svg viewBox="0 0 60 60" aria-hidden="true"><path class="asta" d="M30 21V8"/><path class="punta" d="M23 11 30 2 37 11Z"/></svg></span>` });
/** Incendios activos de todo Chile: punto y, en 24 h, los círculos de ~70 % y ~85 % y la flecha si el viento es fuerte. */
function pintarFuegos() {
  capaZonas.clearLayers(); capaPuntos.clearLayers();
  for (const x of D.activos?.incendios ?? []) {
    const sel = S.sel?.tipo === "fuego" && S.sel.id === x.id;
    if (conCirculos()) {
      L.circle([x.lat, x.lon], { radius: x.radio_km_85 * 1000, color: MORADO, weight: 1.5, opacity: 0.85, dashArray: "5 5", fillColor: MORADO, fillOpacity: 0.06, interactive: false }).addTo(capaZonas);
      L.circle([x.lat, x.lon], { radius: x.radio_km_70 * 1000, color: MORADO, weight: sel ? 3 : 2, opacity: 0.95, fillColor: MORADO, fillOpacity: sel ? 0.24 : 0.16, interactive: false }).addTo(capaZonas);
      if (x.mostrar_flecha && x.viento) L.marker([x.lat, x.lon], { icon: iconoViento(x.viento.hacia_grados), interactive: false, keyboard: false }).addTo(capaZonas);
    }
    L.circleMarker([x.lat, x.lon], { radius: sel ? 8.5 : 6, color: sel ? "#0a1b44" : "#ffffff", weight: 2, fillColor: MORADO, fillOpacity: 1 })
      .bindTooltip(`<strong>${esc(x.comuna)}</strong> · incendio activo (satélite)${x.mostrar_flecha && conCirculos() ? " · viento fuerte" : ""}`)
      .on("click", (e) => { L.DomEvent.stopPropagation(e); elegir("fuego", x.id, false); }).addTo(capaPuntos);
  }
}
/** Sectores de 1 km de la lista de alertas, numerados en el orden del back (el mismo número que en plataforma.html). */
function pintarSectores() {
  capaSectores.clearLayers();
  sectoresLista().forEach((a, n) => {
    const sel = S.sel?.tipo === "sector" && S.sel.id === a.sector_id;
    L.marker([a.lat, a.lon], { icon: L.divIcon({ className: `mk-sector tipo-${a.tipo}${sel ? " sel" : ""}`, html: `<span>${n + 1}</span>`, iconSize: [22, 22] }), zIndexOffset: sel ? 1000 : 0, keyboard: false })
      .bindTooltip(`<strong>N.º ${n + 1} de la lista · ${esc(a.comuna)}</strong><br>sector de 1 km · ${esc(TIPO_ETQ[a.tipo] ?? a.tipo)}`)
      .on("click", (e) => { L.DomEvent.stopPropagation(e); elegir("sector", a.sector_id, false); }).addTo(capaSectores);
  });
  verSectores();
}
function verSectores() {
  if (!mapa || !capaSectores) return;
  const ver = mapa.getZoom() >= ZOOM_SECTORES;
  if (ver && !mapa.hasLayer(capaSectores)) capaSectores.addTo(mapa);
  if (!ver && mapa.hasLayer(capaSectores)) capaSectores.remove();
}
/** Encuadre: la región elegida (sin islas) o, en todo Chile, los incendios activos y las comunas en alto o muy alto. */
function ajustar() {
  if (S.region) {
    const feats = D.contornos.features.filter((f) => regionDe(f.properties.region_id) === S.region), tierra = feats.filter(esContinental);
    if (feats.length) mapa.fitBounds(L.geoJSON({ type: "FeatureCollection", features: tierra.length ? tierra : feats }).getBounds(), { padding: [24, 24] });
    return;
  }
  const pts = (D.activos?.incendios ?? []).map((x) => [x.lat, x.lon]);
  for (const i of riesgo()?.items ?? []) if (nivelIdx(i.nivel) >= 2 && capasComuna[i.region_id]) pts.push(capasComuna[i.region_id].getBounds().getCenter());
  mapa.fitBounds(pts.length ? L.latLngBounds(pts).pad(0.08) : LIMITES_CHILE);
}
function pintarLeyenda() {
  const fs = D.activos?.incendios ?? [];
  $("#ley").innerHTML = `<strong>Nivel de riesgo · ${esc(hNombre())}</strong>
    <div class="niveles">${NIVELES.map((n) => `<span><i style="background:${NIVEL_COLOR[n]}"></i>${esc(NIVEL_TXT[n])}</span>`).join("")}</div>
    ${fs.length ? `<div class="ley-f"><span><i class="m-fuego"></i>Incendio activo (satélite)</span>
      ${conCirculos() ? `<span><i class="m-zona"></i>Avance probable mañana: ~70 % y ~85 %</span>${fs.some((x) => x.mostrar_flecha) ? `<span><i class="m-viento">&uarr;</i>Viento fuerte</span>` : ""}`
        : `<span class="nota-ley">La zona de avance se ve en 24 h: vale para el día siguiente.</span>`}</div>` : ""}
    ${sectoresLista().length ? `<div class="ley-f"><span><i class="m-sector"></i>Sector de 1 km en la lista de alertas (Valparaíso): se ve al acercar</span></div>` : ""}`;
}

/* ---------- tarjeta ---------- */
function tarjetaFuego(x) {
  const v = D.activos?.validacion, it = riesgoDe(x.region_id);
  const grande = conCirculos()
    ? `<div class="grande"><strong>${dec(x.radio_km_70, 1)} km</strong><span>avance probable mañana: ~70 % dentro de este radio<br><b>~85 % dentro de ${dec(x.radio_km_85, 1)} km</b> · prueba ${esc(v?.periodo_prueba ?? "2022-2026")}</span></div>`
    : `<div class="grande"><strong>${x.focos_ultimo_dia}</strong><span>${x.focos_ultimo_dia === 1 ? "foco" : "focos"} el último día con datos<br>La zona de avance se muestra en <b>24 h</b>: vale para el día siguiente.</span></div>`;
  return `<button type="button" class="cerrar" data-cerrar aria-label="Cerrar">&times;</button>
    <p class="etq">Incendio activo <span class="marca-sat">satélite</span></p>
    <h2>${esc(x.comuna)}</h2>
    <p class="sub">${esc(x.region)} · ${esc(coord(x))}</p>
    ${grande}
    <h3 class="etq">Focos</h3>
    <ul class="datos"><li><span>Primer foco</span><b>${esc(fLarga(x.inicio))}</b></li><li><span>Último foco</span><b>${esc(fLarga(x.ultimo_foco))}</b></li>
      <li><span>Focos el último día</span><b>${x.focos_ultimo_dia}</b></li><li><span>Días con focos</span><b>${x.dias_con_focos}</b></li><li><span>Focos en total</span><b>${x.focos_incendio}</b></li></ul>
    <h3 class="etq">Viento</h3>
    <p class="txt">${esc(textoViento(x.viento))}${x.mostrar_flecha && conCirculos() ? ` La flecha marca hacia dónde sopla: con viento fuerte, el avance siguió al viento el ${Math.round(v?.acierto_45_viento_fuerte_prueba_pct ?? 36)} % de las veces (al azar, ${Math.round(v?.acierto_45_azar_pct ?? 25)} %).` : ""}</p>
    ${it ? `<h3 class="etq">Riesgo de la comuna · ${esc(hNombre())}</h3>
      <button type="button" class="fila" data-sel="comuna:${esc(x.region_id)}"><span class="prio">&rarr;</span><span class="que"><strong>${esc(x.comuna)}</strong><small>ver la comuna</small></span><span class="prob"><b>${pct(it.p)}</b>${chipNivel(it.nivel)}</span></button>` : ""}
    <p class="origen">${esc(D.activos?.nota ?? "")}</p>
    <a class="enlace-plat" href="${urlPlataforma(x.region_id)}">Ver la comuna en la plataforma &rarr;</a>`;
}
function tarjetaComuna(id) {
  const it = riesgoDe(id), nom = D.nombres[id], r = riesgo();
  if (!it || !nom) return "";
  // Clima, motivos y qué hacer: de comunas.json (contrato 0.8, las 345 comunas) o, si no está, del piloto de Valparaíso.
  const al = D.comunas?.porId.get(id) ?? D.alertas?.comunas?.find((c) => c.region_id === id), k = al?.clima_ultimo_dia;
  const lista = sectoresLista(), sect = lista.filter((a) => a.region_id === id);
  const fs = (D.activos?.incendios ?? []).filter((x) => x.region_id === id);
  const recs = (al?.recomendaciones?.[S.h] ?? al?.recomendaciones_clima ?? []).map((c) => recomendacion(D.rec, c)).filter(Boolean);
  return `<button type="button" class="cerrar" data-cerrar aria-label="Cerrar">&times;</button>
    <p class="etq">Comuna ${chipNivel(it.nivel)}</p>
    <h2>${esc(nom.nombre)}</h2>
    <p class="sub">${esc(nom.region)} · riesgo para el ${esc(periodoTxt(r.periodo))}</p>
    <div class="grande"><strong>${pct(it.p)}</strong><span>probabilidad de al menos un foco en la comuna<br><b>${esc(hNombre())}</b>${r.orientativo ? " · orientativo" : ""}</span></div>
    ${fs.length ? `<h3 class="etq">Fuego activo en la comuna</h3><ul class="lista">${fs.map((x, n) => filaFuego(x, n + 1)).join("")}</ul>` : ""}
    ${recs.length ? `<h3 class="etq">Qué hacer · ${esc(hNombre())}</h3><ul class="recs">${recs.map((x) => `<li>${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.fuente ?? "Fuente")}</a>` : ""}</li>`).join("")}</ul>`
      : al ? `<h3 class="etq">Qué hacer · ${esc(hNombre())}</h3><p class="txt">Sin recomendaciones para este horizonte: la comuna no está en nivel alto ni tuvo condiciones extremas de clima el último día.</p>` : ""}
    ${al?.motivos?.length ? `<h3 class="etq">Por qué</h3><ul class="motivos">${al.motivos.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    ${k ? `<h3 class="etq">Clima del ${esc(fLarga(k.fecha_clima))}</h3><p class="txt">${dec(k.tmax, 1)} °C máx. · humedad mín. ${dec(k.hrmin, 0)} % · viento ${dec(k.viento_max_kmh, 0)} km/h · ${plural(k.dias_sin_lluvia, "día", "días")} sin lluvia</p>` : ""}
    ${sect.length ? `<h3 class="etq">${esc(D.alertas.listas?.[S.h]?.titulo ?? "Sectores en la lista")} · ${plural(sect.length, "sector", "sectores")} de 1 km</h3>
      <ul class="lista">${sect.map((a) => filaSector(a, lista.indexOf(a) + 1)).join("")}</ul>` : ""}
    <p class="origen">${r.orientativo && r.nota ? `<b>Orientativo.</b> ${esc(r.nota)} ` : ""}${regionDe(id) === "05" ? "" : `Los sectores de 1 km y las alertas son del piloto de la Región de Valparaíso. ${esc(D.comunas?.nota ?? "")}`}</p>
    <a class="enlace-plat" href="${urlPlataforma(id)}">${sect.length ? "Ver sectores y alertas en la plataforma" : "Ver la comuna en la plataforma"} &rarr;</a>`;
}
function filaSector(a, n) {
  return `<li><button type="button" class="fila sector" data-sel="sector:${esc(a.sector_id)}" aria-pressed="${S.sel?.id === a.sector_id}">
    <span class="prio">${n}</span>
    <span class="que"><strong>N.º ${n} de la lista</strong><small>${esc(TIPO_ETQ[a.tipo] ?? a.tipo)}${a.tipo === "fuego_activo" && a.dist_foco_reciente_km != null ? ` · a ${dec(a.dist_foco_reciente_km, 1)} km del foco` : ""}</small></span>
    <span class="prob"><b>${pct(a.prob_si_fuego_en_comuna)}</b><small>si hay fuego en la comuna</small></span></button></li>`;
}
/** Tarjeta de un sector de 1 km de la lista de alertas (modelo B del piloto de Valparaíso). */
function tarjetaSector(a) {
  const lista = sectoresLista(), n = lista.indexOf(a) + 1, info = D.alertas?.listas?.[S.h];
  const recs = (a.recomendaciones ?? []).map((c) => recomendacion(D.rec, c)).filter(Boolean);
  return `<button type="button" class="cerrar" data-cerrar aria-label="Cerrar">&times;</button>
    <p class="etq">Sector de 1 km ${chipTipo(a.tipo)}</p>
    <h2>${esc(a.comuna)} · n.º ${n} de ${lista.length} en la lista</h2>
    <p class="sub">${esc(info?.titulo ?? "Lista de alertas")} · ${esc(coord(a))}</p>
    <div class="grande"><strong>${pct(a.prob_si_fuego_en_comuna)}</strong><span>si hay fuego en la comuna, probabilidad de que caiga en este sector<br><b>${esc(hNombre())}</b></span></div>
    <ul class="datos">
      <li><span>Probabilidad de foco en la comuna</span><b>${pct(a.prob_foco_comuna)}</b></li>
      <li><span>Si hay fuego aquí, que sea un incendio grande</span><b>${pct(a.prob_incendio_grande)}</b></li>
      ${a.tipo === "fuego_activo" && a.dist_foco_reciente_km != null ? `<li><span>Distancia al foco más reciente</span><b>${dec(a.dist_foco_reciente_km, 1)} km</b></li>` : ""}</ul>
    ${a.rasgos?.length ? `<h3 class="etq">Rasgos</h3><ul class="motivos">${a.rasgos.map((k) => `<li>${esc(D.rec?.rasgos?.[k] ?? k)}</li>`).join("")}</ul>` : ""}
    ${recs.length ? `<h3 class="etq">Qué hacer</h3><ul class="recs">${recs.map((x) => `<li>${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.fuente ?? "Fuente")}</a>` : ""}</li>`).join("")}</ul>` : ""}
    <h3 class="etq">Comuna</h3>
    <button type="button" class="fila" data-sel="comuna:${esc(a.region_id)}"><span class="prio">&rarr;</span><span class="que"><strong>${esc(a.comuna)}</strong><small>ver la comuna</small></span><span class="prob">${chipNivel(a.nivel_comuna)}</span></button>
    <p class="origen">${esc(D.alertas?.validacion?.nota ?? "")}</p>
    <a class="enlace-plat" href="${urlPlataforma(a.region_id, a.sector_id)}">Ver la ficha del sector en la plataforma &rarr;</a>`;
}
/** Punto del mapa al que se pega la tarjeta: el incendio, el sector o el centro de la comuna. */
function puntoSel() {
  if (S.sel?.tipo === "fuego") { const x = D.activos?.incendios.find((i) => i.id === S.sel.id); return x ? L.latLng(x.lat, x.lon) : null; }
  if (S.sel?.tipo === "sector") { const a = sectoresLista().find((i) => i.sector_id === S.sel.id); return a ? L.latLng(a.lat, a.lon) : null; }
  if (S.sel?.tipo === "comuna") return capasComuna[S.sel.id]?.getBounds().getCenter() ?? null;
  return null;
}
function pintarTarjeta() {
  const caja = $("#tarjeta");
  const html = S.sel?.tipo === "fuego" ? (() => { const x = D.activos?.incendios.find((i) => i.id === S.sel.id); return x ? tarjetaFuego(x) : ""; })()
    : S.sel?.tipo === "comuna" ? tarjetaComuna(S.sel.id)
    : S.sel?.tipo === "sector" ? (() => { const a = sectoresLista().find((i) => i.sector_id === S.sel.id); return a ? tarjetaSector(a) : ""; })() : "";
  if (!html) { S.sel = null; caja.hidden = true; caja.innerHTML = ""; return; }
  caja.hidden = false; caja.innerHTML = html; caja.scrollTop = 0;
  posicionarTarjeta();
}
/** Pone el cuadro al costado de lo elegido; si no cabe a la derecha, lo pasa a la izquierda. */
function posicionarTarjeta() {
  const caja = $("#tarjeta"), p = puntoSel();
  if (!p || caja.hidden || !mapa) return;
  const pt = mapa.latLngToContainerPoint(p), W = mapa.getSize().x, H = mapa.getSize().y;
  const w = caja.offsetWidth, h = caja.offsetHeight, sep = 20;
  let x = pt.x + sep; if (x + w > W - 8) x = pt.x - sep - w;
  x = Math.max(8, Math.min(x, W - w - 8));
  const y = Math.max(8, Math.min(pt.y - 48, H - h - 8));
  caja.style.left = x + "px"; caja.style.top = y + "px";
}

/* ---------- tablero: lo que hay hoy en la zona y el acierto real del modelo ---------- */
function pintarTablero() {
  const r = riesgo(), m = S.h === "24" ? D.metricas : r?.metricas, pn = D.man?.datos?.prueba_nueva, v = D.activos?.validacion;
  const altas = (r?.items ?? []).filter((i) => enZona(i.region_id) && nivelIdx(i.nivel) >= 2).length;
  const celda = (t, val, nota) => `<div class="m"><span>${t}</span><strong>${val}</strong><small>${nota}</small></div>`;
  const acierto = !m ? `<p class="vacio">Sin métricas del back para este horizonte.</p>` : `<div class="ms">
    ${celda("AUC", dec(m.auc, 3), `prueba ${esc(m.periodo_prueba ?? "")} · azar 0,5`)}
    ${m.captura_top10 != null ? celda("El 10 % con más riesgo", Math.round(m.captura_top10 * 100) + " %", "del fuego de la prueba cayó ahí (azar: 10 %)") : ""}
    ${S.h === "24" && pn ? celda("2026, datos nunca vistos", dec(pn.auc, 3), `AUC ene-oct · climatología ${dec(pn.auc_climatologia, 3)}`)
      : m.ventaja_sobre_climatologia ? celda("Sobre la climatología", "×" + dec(m.ventaja_sobre_climatologia, 2), `precisión media ${dec(m.precision_media, 2)} vs ${dec(m.precision_media_climatologia, 2)}`) : ""}
    ${conCirculos() && v ? celda("Zona de avance (mañana)", Math.round(v.cobertura_prueba_pct.p90) + " %", `del frente nuevo cayó dentro de ${dec(v.radios_km.p90, 1)} km (prueba ${esc(v.periodo_prueba)})`) : ""}</div>`;
  $("#tablero").innerHTML = `<h2 class="etq">Hoy · ${esc(zonaTxt())}</h2><div class="ms">
      ${celda("Comunas en riesgo alto o muy alto", altas, `${esc(hNombre())}${r ? " · " + esc(periodoTxt(r.periodo)) : ""}`)}
      ${D.activos ? celda("Incendios activos", fuegos().length, `satélite, 3 días hasta el ${esc(fLarga(D.activos.ultimo_dato))}`) : ""}</div>
    <h2 class="etq">Acierto del modelo · ${esc(hNombre())}</h2>${acierto}
    ${r?.orientativo ? `<p class="origen"><b>Orientativo.</b> ${esc(r.nota ?? "")}</p>` : ""}`;
}

/* ---------- control ---------- */
function repintar() { pintarBarra(); pintarComunas(); pintarFuegos(); pintarSectores(); pintarLeyenda(); pintarCola(); pintarTarjeta(); pintarTablero(); }
function elegir(tipo, id, volar = true) {
  S.sel = { tipo, id };
  marcarComunas(); pintarFuegos(); pintarSectores(); pintarCola(); pintarTarjeta();
  if (volar) {
    const p = puntoSel();
    if (tipo === "comuna" && capasComuna[id]) mapa.flyToBounds(capasComuna[id].getBounds(), { maxZoom: 10, padding: [60, 60], duration: 0.6 });
    else if (p) mapa.flyTo(p, Math.max(mapa.getZoom(), tipo === "sector" ? 13 : 11), { duration: 0.6 });
  }
  document.querySelector(`#lista .fila[data-sel="${CSS.escape(tipo + ":" + id)}"]`)?.scrollIntoView({ block: "nearest" });
}
function cerrar() { S.sel = null; marcarComunas(); pintarFuegos(); pintarSectores(); pintarCola(); pintarTarjeta(); }
async function cambiarHorizonte(h) {
  S.h = horizonteValido(h); fijarHash();
  D.r[S.h] = await back.riesgo(S.h);
  repintar();
}
function elegirDesde(e) {
  const b = e.target.closest("[data-sel]");
  if (!b) return false;
  const [tipo, ...resto] = b.dataset.sel.split(":");
  elegir(tipo, resto.join(":"));
  return true;
}

$("#horizontes").addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (b && b.dataset.h !== S.h) cambiarHorizonte(b.dataset.h).catch(fallo); });
$("#region").addEventListener("change", (e) => { S.region = e.target.value; S.sel = null; S.todos = false; fijarHash(); repintar(); ajustar(); });
$("#abrir-cola").addEventListener("click", () => {
  const abierta = $("#cola").hidden; $("#cola").hidden = !abierta;
  $("#abrir-cola").setAttribute("aria-expanded", String(abierta));
  if (abierta) $("#cola").focus({ preventScroll: true });
});
$("#tarjeta").addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]")) cerrar(); else elegirDesde(e); });
$("#lista").addEventListener("click", (e) => {
  if (e.target.closest("[data-todos]")) { S.todos = !S.todos; pintarCola(); return; }
  elegirDesde(e);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sel) cerrar(); });

function fallo(e) {
  console.error(e);
  $("#lista").innerHTML = `<li class="vacio">No se pudieron leer los datos del back: ${esc(e.message)}</li>`;
  $("#tablero").innerHTML = `<p class="vacio">No se pudieron leer los datos del back. No se muestran datos inventados en su lugar.</p>`;
}
async function iniciar() {
  leerHash();
  crearMapa();
  const [man, contornos, activos, metricas, alertas, rec, r, comunas] = await Promise.all([
    back.manifest(), api.contornos(), back.avance(), back.metricas().catch(() => null),
    back.alertas("05").catch(() => null), back.recomendaciones().catch(() => null), back.riesgo(S.h), back.comunas()]);
  Object.assign(D, { man, contornos, activos, metricas, alertas, rec, comunas });
  D.r[S.h] = r;
  for (const f of contornos.features) D.nombres[f.properties.region_id] = f.properties;
  repintar(); ajustar();
}
iniciar().catch(fallo);
