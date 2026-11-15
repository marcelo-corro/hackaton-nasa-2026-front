// Plataforma web de Preaviso: País, Región y Comuna en una sola pantalla, alimentada por lo que publica el back (contrato 0.7).
// Los datos reales entran por api.js (objeto `back`); las reglas de cálculo están en riesgo.js. Los incendios activos del
// satélite con su zona probable de avance (contrato 0.7) se ven siempre (círculos y flecha solo en 24 h). El "modo visión"
// (incendios con probabilidades de ejemplo, con etiqueta grande) está escondido para la entrega: ver la constante VISION.
import { api, back } from "./api.js";
import { CONFIG } from "./config.js";
import { aHash, leerHash } from "./prediccion.js";
import { HORIZONTES, horizonteValido, NIVELES, NIVEL_TXT, NIVEL_COLOR, nivelIdx, regionDe, agruparRegiones, claseSector, pctTxt, periodoTxt, leerFocosCsv, recomendacion } from "./riesgo.js";
import { nombreCorto, esContinental, localizarIncendios } from "./region.js";
import { FECHAS, FECHA_INICIAL, diaValido, UMBRAL_ALERTA, esAlerta, horaDe, horaTxt, ordenarCola, filtrar, claseP, NIVELES_P, COLORES_P } from "./triaje.js";
import { $, esc, dec, fFecha, leer, guardar } from "./util.js";

/** Modo visión (incendios de ejemplo de enero con probabilidades inventadas): escondido para la entrega. true lo vuelve a mostrar. */
const VISION = false;
const S = { vista: "pais", h: "24", dia: FECHA_INICIAL, region: null, comuna: null, sector: null, inc: null, tab: null,
  vision: VISION && !!leer("preaviso.vision", false), focos: false, paisTodo: false, abiertas: new Set() };
const D = { contornos: null, nombres: {}, riesgo: {}, regs: {}, inc: {}, sect: {} };   // lo ya pedido
let mapa = null, capas = {}, ultimaVista = null, capaFuegos = null, capaDetalle = null, capaFocos = null, capaAlertas = null, capaActivos = null, CTX = {};
let marcadoresActivos = {};   // punto de cada incendio activo en el mapa, para abrir su ficha desde la lista
const fp = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const nombreDe = (id) => D.nombres[id]?.nombre ?? id;
const LIMITES_CHILE = [[-55.9, -75.7], [-17.5, -66.4]];
const RN = { bajo: 0, medio: 2, alto: 3, muy_alto: 4 };   // clase de color (r0 a r4) de cada nivel del back
const chipNivel = (n) => `<span class="nivel r${RN[n] ?? 0}">Riesgo ${NIVEL_TXT[n]?.toLowerCase() ?? "sin dato"}</span>`;
const COLORES_S = ["#fde7d6", "#fbb98a", "#f2793f", "#d4310f", "#7a1308"];   // sectores: percentil dentro de la comuna
const ANILLO = ["#f2b36b", "#f2b36b", "#f2793f", "#fc3d21", "#7a1308"];
const TIPO_ACTIVO = { vivienda: "Viviendas", escuela: "Escuela", salud: "Salud", planta: "Planta forestal", ruta: "Ruta", electrico: "Línea eléctrica" };
const COLOR_ACTIVO = { vivienda: "#1f6e8c", escuela: "#5f8f6b", salud: "#7c688a", planta: "#a06a2c", ruta: "#51616c", electrico: "#c9a227" };
const hNombre = (h = S.h) => HORIZONTES.find((x) => x.id === h).nombre;

// ------------------------------------------------------------------ datos
async function cargarContornos() {
  if (D.contornos) return;
  D.contornos = await api.contornos();
  for (const f of D.contornos.features) D.nombres[f.properties.region_id] = f.properties;
}
const geoDe = (id) => D.contornos.features.find((f) => f.properties.region_id === id);
async function riesgo() {
  const [r, man] = await Promise.all([back.riesgo(S.h), back.manifest(), cargarContornos()]);
  D.manifest = man;   // manifest.datos trae la fecha de los datos y su nota: nada de fechas fijas en el código
  D.riesgo[S.h] = r;
  D.regs[S.h] ??= agruparRegiones(r.items, D.nombres);
  return r;
}
const porComuna = (r) => Object.fromEntries(r.items.map((i) => [i.region_id, i]));
/** Las comunas con sectores y alertas (las 36 de Valparaíso hoy) salen del manifest. */
async function conSectores() { return new Set((await back.manifest()).sectores?.regiones ?? []); }
async function incendios() {
  if (!S.vision) return null;
  if (!D.inc[S.dia]) {
    const [t] = await Promise.all([api.triaje(S.dia), cargarContornos()]);
    D.inc[S.dia] = { ...t, incendios: localizarIncendios(t.incendios, D.contornos.features) };
  }
  return D.inc[S.dia];
}
/** Clima, motivos y recomendaciones de las 345 comunas (contrato 0.8). Si el back no lo publica queda en null. */
async function comunasPais() {
  if (D.comunasPais === undefined) D.comunasPais = await back.comunas();
  return D.comunasPais;
}
/** Incendios activos del satélite (contrato 0.7). Si el back no los publica queda en null y la capa no aparece. */
async function activos() {
  if (D.activos === undefined) D.activos = await back.avance();
  return D.activos;
}
/** Los incendios activos de la vista: todos en el país, los de la región (dos primeros dígitos) o los de la comuna. Los más recientes primero. */
const activosAqui = () => (D.activos?.incendios ?? [])
  .filter((x) => (S.vista === "comuna" ? x.region_id === S.comuna : S.vista === "region" ? regionDe(x.region_id) === S.region : true))
  .sort((a, b) => b.ultimo_foco.localeCompare(a.ultimo_foco) || b.focos_ultimo_dia - a.focos_ultimo_dia);
const umbral = () => D.inc[S.dia]?.modelo?.umbral ?? UMBRAL_ALERTA;
const aqui = () => (!S.vision ? [] : ordenarCola(filtrar(D.inc[S.dia]?.incendios ?? [], S.vista === "comuna" ? { comuna: S.comuna } : S.vista === "region" ? { region: S.region } : {})));
const alcance = () => (S.vista === "comuna" ? "en la comuna" : S.vista === "region" ? "en la región" : "en Chile");

// ------------------------------------------------------------------ marco: menú lateral (horizonte, modo visión y zonas) y pie
const ORDEN_REG = ["15", "01", "02", "03", "04", "05", "13", "06", "07", "16", "08", "09", "14", "10", "11", "12"];   // de norte a sur
let regionDelRail = null;
function pintarHorizontes() {
  const caja = $("#rail-h");
  if (!caja.children.length) {
    caja.innerHTML = HORIZONTES.map((x) => `<button type="button" role="radio" aria-checked="false" data-h="${x.id}"><strong>${esc(x.nombre.split(" ")[0])}</strong><small>${esc(x.nombre.split(" ")[1])}</small></button>`).join("");
  }
  for (const b of caja.children) b.setAttribute("aria-checked", String(b.dataset.h === S.h));
  const r = D.riesgo[S.h];
  $("#rail-periodo").innerHTML = r ? `Riesgo para el <strong>${esc(periodoTxt(r.periodo))}</strong>` : "";
}
function pintarVision() {
  $("#vision-btn").closest(".rail-bloque").hidden = !VISION;
  $("#vision-btn").setAttribute("aria-pressed", String(S.vision));
  $("#rail-dia").hidden = !S.vision; $("#rail-ej").hidden = !S.vision;
  const caja = $("#rail-dia");
  if (S.vision && !caja.children.length) {
    caja.innerHTML = FECHAS.map((f) => `<button type="button" role="radio" aria-checked="false" data-dia="${f}" title="${esc(fFecha(f, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}">
      <span>${esc(fFecha(f, { weekday: "short" }))}</span><strong>${esc(fFecha(f, { day: "numeric" }))}</strong><small>${esc(fFecha(f, { month: "short" }))}</small></button>`).join("");
  }
  for (const b of caja.children) b.setAttribute("aria-checked", String(b.dataset.dia === S.dia));
}
/** Árbol País, regiones y comunas. Se arma una vez por horizonte (los colores cambian) y después solo se marcan la zona activa y los desplegables abiertos. */
function pintarArbol() {
  const regs = D.regs[S.h], r = D.riesgo[S.h], arbol = $("#arbol");
  if (!regs || !r) return;
  if (arbol.dataset.h !== S.h) {
    const pc = porComuna(r);
    const orden = (x) => (ORDEN_REG.includes(x.id) ? ORDEN_REG.indexOf(x.id) : 99);
    arbol.innerHTML = [...regs].sort((x, y) => orden(x) - orden(y)).map((g) => {
      const nombre = nombreCorto(g.nombre);
      const comunas = [...g.comunas].sort((x, y) => nombreDe(x.region_id).localeCompare(nombreDe(y.region_id), "es"));
      const ins = g.nAltas ? `<b class="n-inc hot" title="${g.nAltas} ${g.nAltas === 1 ? "comuna" : "comunas"} en nivel alto o muy alto">${g.nAltas}</b>` : "";
      return `<li class="reg" data-reg="${g.id}"><div class="reg-fila">
        <button type="button" class="reg-nombre" data-region="${g.id}"><i class="r${RN[g.nivel]}" aria-hidden="true"></i><span>${esc(nombre)}</span>${ins}</button>
        <button type="button" class="reg-flecha" data-toggle="${g.id}" aria-expanded="false" aria-label="Comunas de ${esc(nombre)}"></button></div>
        <div class="com-caja"><ul class="com-lista">${comunas.map((c) => `<li><button type="button" data-comuna="${c.region_id}"><i class="r${RN[pc[c.region_id]?.nivel] ?? 0}" aria-hidden="true"></i><span>${esc(nombreDe(c.region_id))}</span></button></li>`).join("")}</ul></div></li>`;
    }).join("");
    arbol.dataset.h = S.h;
  }
  if (S.region !== regionDelRail) { if (S.region) S.abiertas.add(S.region); regionDelRail = S.region; }
  for (const li of arbol.children) {
    const abierta = S.abiertas.has(li.dataset.reg);
    li.classList.toggle("abierta", abierta);
    li.querySelector(".reg-flecha").setAttribute("aria-expanded", String(abierta));
    const n = li.querySelector(".reg-nombre");
    n.classList.toggle("dentro", S.region === li.dataset.reg && S.vista !== "region");
    if (S.vista === "region" && S.region === li.dataset.reg) n.setAttribute("aria-current", "page"); else n.removeAttribute("aria-current");
  }
  for (const b of arbol.querySelectorAll("[data-comuna]")) { if (S.vista === "comuna" && b.dataset.comuna === S.comuna) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
  const pais = document.querySelector(".arbol-pais");
  if (S.vista === "pais") pais.setAttribute("aria-current", "page"); else pais.removeAttribute("aria-current");
  arbol.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function pintarMarco() {
  pintarHorizontes(); pintarVision(); pintarArbol();
  $("#fuente-datos").textContent = "Riesgo, alertas, sectores e incendios activos leídos del back (contrato " + (D.manifest?.contrato ?? "") + ")." + (S.vision ? " Incendios del modo visión: probabilidades de ejemplo." : "");
}
/** Cifras que suben desde cero al entrar a una pantalla. */
function animarCifras(raiz = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of raiz.querySelectorAll("[data-cuenta]")) {
    const fin = Number(el.dataset.cuenta), t0 = performance.now();
    const paso = (t) => { const k = Math.min(1, (t - t0) / 800); el.textContent = Math.round(fin * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(paso); };
    el.textContent = "0"; requestAnimationFrame(paso);
  }
}
const pestanas = (lista) => (lista.length < 2 ? "" : `<div class="pestanas" role="tablist" aria-label="Contenido">${lista.map(([id, txt]) =>
  `<button type="button" role="tab" aria-selected="${S.tab === id}" data-tab="${id}">${esc(txt)}</button>`).join("")}</div>`);

/** Fecha de los datos y, si el back lo marca, el aviso de que el horizonte es orientativo. */
function bloquePeriodo(r) {
  return `<p class="periodo">Riesgo para el <strong>${esc(periodoTxt(r.periodo))}</strong> &middot; horizonte ${esc(hNombre(r.horizonte))}</p>
    ${r.orientativo ? `<p class="aviso-origen"><b>Orientativo.</b> ${esc(r.nota ?? "")}</p>` : r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ""}
    ${D.manifest?.datos?.nota ? `<p class="nota">${esc(D.manifest.datos.nota)}</p>` : ""}
    <p class="nota">El nivel de cada horizonte usa sus propios cortes: no se comparan entre horizontes.</p>`;
}
function tarjetasRiesgo(items) {
  const altas = items.filter((i) => nivelIdx(i.nivel) >= 2).length, muy = items.filter((i) => i.nivel === "muy_alto").length;
  return `<div class="tarjetas"><div class="tarjeta"><strong data-cuenta="${altas}">${altas}</strong><span>Comunas en nivel alto o muy alto</span></div>
    <div class="tarjeta t-alerta${muy ? " activa" : ""}"><strong data-cuenta="${muy}">${muy}</strong><span>En nivel muy alto</span></div></div>`;
}
const ETIQUETA_EJ = `<div class="ejemplo-grande" role="note"><strong>Datos de ejemplo</strong><span>No son del modelo</span></div>`;

// ------------------------------------------------------------------ incendios del modo visión: cola y ficha
function filaIncendio(i, n = 0) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral());
  return `<li style="--i:${n}"><button type="button" class="${al ? "alerta" : ""}" style="--c:${ANILLO[c]}" data-incendio="${i.id}" aria-pressed="${i.id === S.inc}">
    <span class="prio">${i.prioridad}</span>
    <span class="que"><strong>${esc(i.nombre)}</strong><small>${esc(i.comuna)} &middot; ${horaTxt(horaDe(i))} &middot; ${esc(i.comb_inicial ?? "combustible sin dato")}</small></span>
    <span class="valor"><i class="r${c}" aria-hidden="true"></i>${Math.round(i.p_no_control_dia * 100)} %<small class="ej-mini">ejemplo</small></span></button></li>`;
}
function fichaIncendio(i, n) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral()), max = Math.max(...i.factores.map((f) => f.aporte_pct));
  return `<div class="ficha"><button type="button" class="boton claro volver-btn" data-inc-cerrar>&larr; Todos los incendios</button>
    ${ETIQUETA_EJ}
    <p class="pista">Prioridad ${i.prioridad} de ${n} ${alcance()}</p>
    <h2 class="ficha-t">${esc(i.nombre)}</h2>
    <p class="bajada">${esc(i.comuna)}, región ${esc(i.region)}. Inició a las ${horaTxt(horaDe(i))}. Combustible: ${esc(i.comb_inicial ?? "sin dato")}.</p>
    <div class="cifra-grande"><strong>${Math.round(i.p_no_control_dia * 100)} %</strong><span class="nivel r${c}">${NIVELES_P[c]} (ejemplo)</span>${al ? '<span class="nivel-alerta">En alerta (ejemplo)</span>' : ""}
      <span>de que no se controle el día de inicio</span></div>
    <p class="aviso-origen"><b>Registro de CONAF:</b> nombre, lugar, hora y combustible. <b>De ejemplo, no son del modelo:</b> probabilidad, factores y activos. <b>Zona de avance:</b> los dos círculos validados con incendios reales (~70 % y ~85 % del avance del día siguiente), sin dirección.</p>
    ${S.comuna === i.comuna_id ? "" : `<button type="button" class="boton claro mini" data-ver-comuna="${i.comuna_id}" data-incendio-ir="${i.id}">Ver en su comuna</button>`}
    <h2>Por qué (ejemplo)</h2>
    <ul class="causas">${i.factores.map((f) => `<li class="nomod"><div class="fila"><span>${esc(f.nombre)}<small>${esc(f.valor)}</small></span><span class="pct">${f.aporte_pct} %</span></div>
      <div class="barra" aria-hidden="true"><b style="width:${(f.aporte_pct / max) * 100}%"></b></div></li>`).join("")}</ul>
    <h2>En el camino (ejemplo)</h2>
    ${i.activos.length ? `<ul class="activos">${i.activos.map((a) => `<li><i style="background:${COLOR_ACTIVO[a.tipo] ?? "#51616c"}" aria-hidden="true"></i>
      <span><strong>${esc(a.nombre)}</strong><small>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; ${a.personas_est ? `~${a.personas_est} personas` : "sin personas"}</small></span>
      <span class="eta">~${dec(a.eta_h, 1)} h</span></li>`).join("")}</ul>
      <p class="nota">Tiempo aproximado de llegada del fuego si avanzara hacia ese punto (ejemplo).</p>` : `<p class="nota">No hay activos en la zona probable de avance.</p>`}
    <p class="apoyo">Apoyo a la decisión: la probabilidad no es una certeza ni una orden operativa.</p></div>`;
}
function contenidoIncendios() {
  const lista = aqui(), i = lista.find((x) => x.id === S.inc);
  if (i) return fichaIncendio(i, lista.length);
  return `${ETIQUETA_EJ}<p class="nota">Incendios del registro de CONAF del ${esc(fFecha(S.dia, { day: "numeric", month: "long", year: "numeric" }))}; las probabilidades son inventadas.</p>
    ${lista.length ? `<ol class="lista-cola">${lista.map(filaIncendio).join("")}</ol>` : `<p class="nota vacia">Sin incendios ese día en esta zona.</p>`}`;
}

// ------------------------------------------------------------------ incendios activos del satélite (contrato 0.7): reales, sin modo visión
const MORADO = "#5b2a86";   // el mismo de "Fuego activo" en las alertas, distinto de los colores de nivel
/** La zona de avance (círculos y flecha) está validada para el día siguiente: se dibuja solo en el horizonte de 24 h, como en la portada. */
const conCirculos = () => S.h === "24";
const PUNTOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
const rumbo = (g) => PUNTOS[Math.round((((Number(g) % 360) + 360) % 360) / 45) % 8];
const fCorta = (iso) => fFecha(iso, { day: "numeric", month: "long" });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function textoViento(v) {
  if (!v) return "Sin dato de viento.";
  return `Viento del ${fCorta(v.fecha)}: viene del ${rumbo(v.desde_grados)} y va hacia el ${rumbo(v.hacia_grados)}, ${dec(v.velocidad_ms * 3.6, 0)} km/h (${v.fuerte ? "fuerte" : "suave"}).`;
}
/** Ficha que se abre al tocar un incendio activo en el mapa. */
function fichaActivo(x) {
  const enSuComuna = S.vista === "comuna" && S.comuna === x.region_id;
  return `<div class="pop-activo"><strong>Incendio activo &middot; ${esc(x.comuna)}</strong><small>${esc(x.region)} &middot; ${esc(coordSector(x))}</small>
    <p>Focos desde el ${esc(fCorta(x.inicio))}; el último, el ${esc(fCorta(x.ultimo_foco))}.</p>
    <p>${plural(x.focos_ultimo_dia, "foco", "focos")} el último día &middot; ${plural(x.dias_con_focos, "día", "días")} con focos &middot; ${x.focos_incendio} en total.</p>
    <p>${esc(textoViento(x.viento))}${x.mostrar_flecha && conCirculos() ? " La flecha marca hacia dónde sopla." : ""}</p>
    <p class="nota">${conCirculos() ? `Zona probable de avance del día siguiente: ~70 % dentro de ${dec(x.radio_km_70, 1)} km y ~85 % dentro de ${dec(x.radio_km_85, 1)} km.`
      : "La zona probable de avance se muestra en el horizonte de 24 h: vale para el día siguiente."}</p>
    ${enSuComuna ? "" : `<a class="boton claro mini" href="${hashDe({ dia: S.dia, h: S.h, comuna: x.region_id })}">Ver la comuna</a>`}</div>`;
}
/** Bloque del panel: cuántos hay en la vista, la nota del back tal cual y la lista (tocar uno lo muestra en el mapa). */
function bloqueActivos(sub = true) {
  const a = D.activos;
  if (!a) return "";
  const titulo = `<h2${sub ? ' class="sub"' : ""}>Incendios activos (satélite)</h2>`;
  if (!a.incendios?.length) return `<section class="activos-sat">${titulo}<p class="nota vacia">Sin incendios activos detectados en los últimos 3 días.</p></section>`;
  const lista = activosAqui(), hasta = fCorta(a.ultimo_dato);
  if (!lista.length) return `<section class="activos-sat">${titulo}<p class="nota vacia">Sin incendios activos detectados ${alcance()} en los últimos 3 días (hasta el ${esc(hasta)}).</p></section>`;
  const conFlecha = lista.filter((x) => x.mostrar_flecha).length;
  const filas = `<ol class="lista-activos">${lista.map((x) => `<li><button type="button" data-activo="${esc(x.id)}">
      <span class="m-activo" aria-hidden="true"></span>
      <span class="que"><strong>${esc(x.comuna)}</strong><small>${S.vista === "pais" ? `${esc(nombreCorto(x.region))} &middot; ` : ""}desde el ${esc(fCorta(x.inicio))} &middot; ${plural(x.focos_ultimo_dia, "foco", "focos")} el último día</small></span>
      ${x.mostrar_flecha ? `<span class="viento-fuerte"><i style="transform:rotate(${Number(x.viento.hacia_grados)}deg)" aria-hidden="true">&uarr;</i>Viento fuerte</span>` : ""}</button></li>`).join("")}</ol>`;
  return `<section class="activos-sat">${titulo}
    <p class="resumen-activos"><strong>${lista.length}</strong> ${lista.length === 1 ? "incendio" : "incendios"} con focos ${alcance()} en los 3 días hasta el ${esc(hasta)}${conFlecha ? ` &middot; ${conFlecha} con viento fuerte` : ""}</p>
    <p class="nota chica">${esc(a.nota)}</p>
    ${conCirculos() ? "" : `<p class="nota chica">En ${esc(hNombre())} se muestran solo los incendios: los círculos y la flecha valen para el día siguiente y se ven en 24 h.</p>`}
    ${lista.length > 3 ? `<details><summary>Ver la lista (${lista.length})</summary>${filas}</details>` : filas}</section>`;
}
/** Línea de la leyenda del mapa, solo si hay incendios activos en la vista. */
function leyendaActivos() {
  const lista = activosAqui();
  if (!lista.length) return "";
  return `<p class="activos-ley"><span class="item"><span class="m-activo" aria-hidden="true"></span>Incendio activo (satélite)</span>
    ${conCirculos() ? `<span class="item"><span class="m-zona" aria-hidden="true"></span>Avance probable mañana: ~70 % y ~85 %</span>
    ${lista.some((x) => x.mostrar_flecha) ? `<span class="item"><span class="m-viento" aria-hidden="true">&uarr;</span>Viento fuerte</span>` : ""}`
      : `<span class="item">La zona de avance se ve en 24 h.</span>`}</p>`;
}
const iconoViento = (grados) => L.divIcon({ className: "mk-viento", iconSize: [64, 64], iconAnchor: [32, 32],
  html: `<span style="transform:rotate(${Number(grados)}deg)"><svg viewBox="0 0 64 64" aria-hidden="true"><path class="asta" d="M32 22V9"/><path class="punta" d="M24 12 32 2 40 12Z"/></svg></span>` });
/** Punto, dos círculos (70 % y 85 %) y, solo con viento fuerte, la flecha hacia donde sopla. No es un cono. */
function pintarActivos() {
  if (!capaActivos) return;
  capaActivos.clearLayers(); marcadoresActivos = {};
  // La leyenda va encima del mapa y taparía la ficha: mientras la ficha está abierta, la leyenda se esconde.
  const leyenda = (ver) => document.querySelector("#leyenda-caja")?.classList.toggle("oculta", !ver);
  // Los botones de zoom quedan arriba a la izquierda: la ficha se deja a su derecha y se angosta si el mapa es chico (teléfono).
  const opcionesFicha = { maxWidth: Math.max(200, Math.min(300, mapa.getSize().x - 110)), autoPanPaddingTopLeft: L.point(54, 10), autoPanPaddingBottomRight: L.point(8, 10) };
  for (const x of activosAqui()) {
    if (conCirculos()) {
      L.circle([x.lat, x.lon], { radius: x.radio_km_85 * 1000, color: MORADO, weight: 1.6, opacity: 0.85, dashArray: "6 5", fillColor: MORADO, fillOpacity: 0.08, interactive: false }).addTo(capaActivos);
      L.circle([x.lat, x.lon], { radius: x.radio_km_70 * 1000, color: MORADO, weight: 2.5, fillColor: MORADO, fillOpacity: 0.2, interactive: false }).addTo(capaActivos);
      if (x.mostrar_flecha && x.viento) L.marker([x.lat, x.lon], { icon: iconoViento(x.viento.hacia_grados), interactive: false, keyboard: false }).addTo(capaActivos);
    }
    const p = L.circleMarker([x.lat, x.lon], { radius: 6.5, color: "#ffffff", weight: 2, fillColor: MORADO, fillOpacity: 1 }).addTo(capaActivos);
    p.bindTooltip(`<strong>${esc(x.comuna)}</strong> &middot; incendio activo (satélite)<br>${plural(x.focos_ultimo_dia, "foco", "focos")} el último día${x.mostrar_flecha && conCirculos() ? " &middot; viento fuerte" : ""}`, { sticky: true });
    p.bindPopup(fichaActivo(x), opcionesFicha);
    p.on("popupopen", () => { p.closeTooltip(); leyenda(false); });
    p.on("popupclose", () => leyenda(true));
    marcadoresActivos[x.id] = p;
  }
}
/** Desde la lista del panel: acerca el mapa al incendio y abre su ficha. */
function verActivo(id) {
  const x = activosAqui().find((i) => i.id === id), p = marcadoresActivos[id];
  if (!x || !p || !mapa) return;
  if (matchMedia("(max-width: 64rem)").matches) document.querySelector(".mapa-caja")?.scrollIntoView({ behavior: "smooth", block: "center" });
  mapa.fitBounds(L.latLng(x.lat, x.lon).toBounds(x.radio_km_85 * 2600), { maxZoom: 13, animate: false });
  p.openPopup();
}

// ------------------------------------------------------------------ mapa
function nuevoMapa(clave, limites, relleno = {}) {
  const previo = mapa && ultimaVista === clave ? { c: mapa.getCenter(), z: mapa.getZoom() } : null;
  if (mapa) { mapa.remove(); mapa = null; }
  capas = {};
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
  L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17 }).addTo(mapa);
  if (CONFIG.TESELAS_NOMBRES) L.tileLayer(CONFIG.TESELAS_NOMBRES, { maxZoom: 17 }).addTo(mapa);
  capaFocos = L.layerGroup().addTo(mapa);
  capaAlertas = L.layerGroup().addTo(mapa);
  capaActivos = L.layerGroup().addTo(mapa);
  capaFuegos = L.layerGroup().addTo(mapa);
  capaDetalle = L.layerGroup().addTo(mapa);
  if (previo) mapa.setView(previo.c, previo.z); else mapa.fitBounds(limites, { paddingTopLeft: [8, 8], paddingBottomRight: [8, 8], ...relleno });
  ultimaVista = clave;
}
/** Leyenda de niveles (país y región): los cuatro niveles del back y los cortes de probabilidad del horizonte, si los trae. */
function leyendaNiveles(r) {
  const u = r.umbrales;
  const cortes = u ? `Desde ${pctTxt(u.medio, 1)} medio, ${pctTxt(u.alto, 1)} alto, ${pctTxt(u.muy_alto, 1)} muy alto.` : "";
  return `<div class="leyenda vertical"><h3>Nivel de riesgo, ${esc(hNombre(r.horizonte))}</h3>
    <p class="niveles-ley">${NIVELES.map((n) => `<span class="item"><i class="sw" style="background:${NIVEL_COLOR[n]}"></i>${NIVEL_TXT[n]}</span>`).join("")}</p>
    ${cortes ? `<p class="nota-ley">${esc(cortes)}</p>` : ""}
    ${leyendaActivos()}
    ${S.vision ? `<p class="fuegos-ley"><span class="item"><span class="m-punto" aria-hidden="true"></span>Incendio de ejemplo</span><span class="item"><span class="m-alerta" aria-hidden="true"></span>En alerta (ejemplo)</span></p>` : ""}</div>`;
}
function leyendaSectores() {
  return `<div class="leyenda vertical"><h3>Orden de cada sector dentro de la comuna</h3>
    <div class="escala"><div class="rampa" aria-hidden="true">${COLORES_S.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="cortes"><span>Menos probable</span><span>Más probable</span></div></div>
    <p class="nota-ley">Color por percentil dentro de la comuna: dónde es más probable que caiga el fuego si lo hay. No predice dónde empieza.</p>
    ${leyendaActivos()}</div>`;
}
const estiloComuna = (nivel, encima) => ({ color: encima ? "#0b0b0b" : NIVEL_COLOR[nivel], weight: encima ? 1.4 : 0.5, opacity: 0.9, fillColor: NIVEL_COLOR[nivel], fillOpacity: encima ? 0.8 : 0.55 });
/** Los incendios del modo visión sobre el mapa. Los que están en alerta llevan un anillo del color de su nivel. */
function pintarFuegos() {
  if (!capaFuegos) return;
  capaFuegos.clearLayers();
  if (!S.vision) return;
  const um = umbral();
  const lista = [...aqui()].sort((a, b) => (esAlerta(a, um) - esAlerta(b, um)) || a.p_no_control_dia - b.p_no_control_dia);
  for (const i of lista) {
    const al = esAlerta(i, um), c = claseP(i.p_no_control_dia), sel = i.id === S.inc;
    const r = al ? 7 + 6 * ((i.p_no_control_dia - um) / (1 - um)) : 4.5;
    if (al) L.circleMarker([i.lat, i.lon], { radius: r + 5, fill: false, color: ANILLO[c], weight: 3, opacity: 0.95, interactive: false }).addTo(capaFuegos);
    const p = L.circleMarker([i.lat, i.lon], { radius: r + (sel ? 3 : 0), color: sel ? "#ffffff" : al ? "#ffffff" : "#1d2a33", weight: sel ? 3.5 : al ? 1.8 : 1, fillColor: COLORES_P[c], fillOpacity: al ? 0.95 : 0.7 }).addTo(capaFuegos);
    p.bindTooltip(`<strong>${esc(i.nombre)}</strong><br>${esc(i.comuna)} &middot; prioridad ${i.prioridad}<br>${Math.round(i.p_no_control_dia * 100)} % de no control (ejemplo, no es del modelo)`, { sticky: true });
    p.on("click", () => elegirIncendio(i.id));
  }
}
/** Radios validados de la zona de avance (~70 % y ~85 % del avance del día siguiente), del back si llegaron. */
const radiosAvance = () => [D.activos?.validacion?.radios_km?.p75 ?? 2.53, D.activos?.validacion?.radios_km?.p90 ?? 3.63];
/** Zona probable de avance del incendio elegido: los dos círculos validados (no un cono, que los datos no respaldan) y sus activos de ejemplo. */
function pintarDetalle() {
  if (!capaDetalle) return;
  capaDetalle.clearLayers();
  const i = aqui().find((x) => x.id === S.inc);
  if (!i) return;
  const color = COLORES_P[claseP(i.p_no_control_dia)], [r70, r85] = radiosAvance();
  L.circle([i.lat, i.lon], { radius: r85 * 1000, color, weight: 1.5, dashArray: "6 5", fillColor: color, fillOpacity: 0.25, interactive: false }).addTo(capaDetalle);
  L.circle([i.lat, i.lon], { radius: r70 * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.4, interactive: false }).addTo(capaDetalle);
  for (const a of i.activos) {
    L.circleMarker([a.lat, a.lon], { radius: 6, color: "#ffffff", weight: 2, fillColor: COLOR_ACTIVO[a.tipo] ?? "#51616c", fillOpacity: 1 }).addTo(capaDetalle)
      .bindTooltip(`<strong>${esc(a.nombre)}</strong><br>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; llega en ~${dec(a.eta_h, 1)} h`);
  }
}
function acercar(i) {
  const zona = L.latLng(i.lat, i.lon).toBounds(radiosAvance()[1] * 2000);
  mapa.fitBounds(zona.extend(L.latLngBounds(i.activos.map((a) => [a.lat, a.lon]).concat([[i.lat, i.lon]]))), { padding: [60, 60], maxZoom: 12, animate: false });
}
/** Mapa de calor de focos históricos de la comuna: círculos translúcidos que se suman donde hay más. */
async function pintarFocos() {
  if (!capaFocos) return;
  capaFocos.clearLayers();
  if (!S.focos || S.vista !== "comuna" || !CTX.sect) return;
  const comuna = S.comuna;
  try {
    const f = leerFocosCsv(await back.focosSector(comuna));
    if (!S.focos || S.comuna !== comuna || !capaFocos) return;
    for (const p of f) L.circleMarker([p.lat, p.lon], { radius: 5, stroke: false, fillColor: "#ff5a00", fillOpacity: 0.22, interactive: false }).addTo(capaFocos);
  } catch (e) { console.error(e); }
}

// ------------------------------------------------------------------ dirección de la página
const hashDe = (n) => {
  const q = new URLSearchParams(aHash(n).slice(1));
  if (!S.vision) { q.delete("dia"); q.delete("incendio"); }
  if (n.h && n.h !== "24") q.set("h", n.h);
  if (n.sector) q.set("sector", n.sector);
  return "#" + q.toString();
};
const hashActual = () => hashDe({ dia: S.dia, h: S.h, region: S.region, comuna: S.comuna, incendio: S.inc, sector: S.sector, vista: S.vista === "metodologia" ? "metodologia" : null });
/** La selección vive en la dirección de la página para poder compartirla, sin repintar todo. */
function fijarHash() { history.replaceState(null, "", hashActual()); }
function elegirIncendio(id) {
  S.inc = id; S.tab = "incendios";
  fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle();
  const i = aqui().find((x) => x.id === id);
  if (i) acercar(i);
}
function cerrarIncendio() { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }

// ------------------------------------------------------------------ panel de cada nivel
const textoRasgo = (k) => CTX.rec?.rasgos?.[k] ?? k;
const chipsRasgos = (lista) => (lista?.length ? `<ul class="chips">${lista.map((k) => `<li>${esc(textoRasgo(k))}</li>`).join("")}</ul>` : "");
const chipsCondiciones = (lista) => (lista?.length ? `<ul class="chips clima">${lista.map((k) => `<li title="${esc(CTX.rec?.condiciones?.[k]?.texto ?? k)}">${esc(CTX.rec?.condiciones?.[k]?.texto ?? k)}</li>`).join("")}</ul>` : "");
/** Lista de recomendaciones con su texto y el enlace a la fuente, tal como las publica el back. */
function listaRecs(codigos) {
  const rs = (codigos ?? []).map((c) => recomendacion(CTX.rec, c)).filter(Boolean);
  if (!rs.length) return "";
  return `<ul class="recs-lista">${rs.map((r) => `<li>${esc(r.texto)}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fuente ?? "Fuente")}</a>` : ""}</li>`).join("")}</ul>`;
}
function listaRegiones(regs) {
  return `<ol class="lista-top">${regs.map((g, n) => `<li style="--i:${n}"><button type="button" data-region="${g.id}"><span>${esc(nombreCorto(g.nombre))}<span class="region">${g.nAltas} de ${g.comunas.length} comunas en nivel alto o muy alto</span></span><span class="valor"><i class="r${RN[g.nivel]}" aria-hidden="true"></i>${NIVEL_TXT[g.nivel]}</span></button></li>`).join("")}</ol>`;
}
function listaComunas(reg) {
  const cs = [...reg.comunas].sort((a, b) => nivelIdx(b.nivel) - nivelIdx(a.nivel) || b.p - a.p || nombreDe(a.region_id).localeCompare(nombreDe(b.region_id), "es"));
  return `<ol class="lista-top">${cs.map((i, n) => `<li style="--i:${n}"><button type="button" data-comuna="${i.region_id}"><span>${esc(nombreDe(i.region_id))}<span class="region">${fp(i.p)} de probabilidad</span></span><span class="valor"><i class="r${RN[i.nivel]}" aria-hidden="true"></i>${NIVEL_TXT[i.nivel]}</span></button></li>`).join("")}</ol>`;
}
function htmlPais() {
  const r = CTX.r, lista = listaRegiones(CTX.regs);
  const cuerpo = S.vision ? (() => {
    const inc = aqui(), i = inc.find((x) => x.id === S.inc);
    if (i) return fichaIncendio(i, inc.length);
    return `<div class="mitades"><section><h2 class="sub">Incendios (ejemplo)</h2>${contenidoIncendios()}</section><section><h2 class="sub">Regiones</h2>${lista}</section></div>`;
  })() : `<h2 class="sub">Regiones</h2>${lista}`;
  return `<h1>Chile</h1>${bloquePeriodo(r)}${tarjetasRiesgo(r.items)}${bloqueActivos()}${cuerpo}`;
}
/** Tipos de alerta del contrato 0.5; el color de fuego activo es propio, distinto de los de nivel. */
const TIPO_ALERTA = {
  fuego_activo: { etiqueta: "Fuego activo", grupo: "Fuego activo: focos en los últimos 3 días", color: "#5b2a86" },
  alerta: { etiqueta: "Alerta", grupo: "Alerta: riesgo alto o muy alto", color: "#d4472b" },
  vigilancia: { etiqueta: "Vigilancia", grupo: "Vigilancia: riesgo medio", color: "#f08a3c" },
};
const chipTipo = (t) => (TIPO_ALERTA[t] ? `<span class="chip-tipo tipo-${t}">${TIPO_ALERTA[t].etiqueta}</span>` : "");
const listaMotivos = (m) => (m?.length ? `<ul class="motivos">${m.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
/** Tarjetas de alertas del back, en su orden: sectores de las comunas con más riesgo y más exposición. */
function tarjetasAlertas() {
  const a = CTX.alertas, lista = a?.horizontes?.[S.h] ?? [], info = a?.listas?.[S.h];
  const titulo = info?.titulo ? `<h2 class="lista-titulo">${esc(info.titulo)}</h2>` : "";
  const respaldo = a?.validacion?.nota ? `<p class="nota chica respaldo">${esc(a.validacion.nota)}</p>` : "";
  if (info?.vacia || !lista.length) {
    return `${titulo}<p class="nota">${esc(info?.mensaje || "No hay alertas para este horizonte.")}</p>${a?.nota ? `<p class="nota chica">${esc(a.nota)}</p>` : ""}${respaldo}`;
  }
  let anterior = null;
  return `${titulo}<p class="nota">${esc(a.nota)}</p><ol class="alertas">${lista.map((x, n) => {
    const encabezado = x.tipo !== anterior && TIPO_ALERTA[x.tipo] ? `<li class="alerta-grupo" aria-hidden="true">${esc(TIPO_ALERTA[x.tipo].grupo)}</li>` : "";
    anterior = x.tipo;
    return `${encabezado}<li class="tipo-${esc(x.tipo)}" style="--c:${TIPO_ALERTA[x.tipo]?.color ?? NIVEL_COLOR[x.nivel_comuna]}"><div class="alerta-cab"><span class="prio">${n + 1}</span><strong>${esc(x.comuna)}</strong>${chipTipo(x.tipo)}${chipNivel(x.nivel_comuna)}</div>
    ${x.tipo === "fuego_activo" && x.dist_foco_reciente_km != null ? `<p class="dist-foco">a ${dec(x.dist_foco_reciente_km, 1)} km del foco más reciente</p>` : ""}
    <dl class="alerta-datos">
      <div><dt>Probabilidad de foco en la comuna</dt><dd>${fp(x.prob_foco_comuna)}</dd></div>
      <div><dt>Si hay fuego en la comuna, que caiga en este sector</dt><dd>${fp(x.prob_si_fuego_en_comuna)}</dd></div>
      <div><dt>Si hay fuego aquí, que sea un incendio grande</dt><dd>${fp(x.prob_incendio_grande)}</dd></div></dl>
    ${chipsRasgos(x.rasgos)}
    <details><summary>Qué hacer (${x.recomendaciones.length})</summary>${listaRecs(x.recomendaciones)}</details>
    <button type="button" class="boton claro mini" data-comuna="${x.region_id}" data-sector="${x.sector_id}">Ver sector en la comuna</button></li>`; }).join("")}</ol>${respaldo}`;
}
/** Clima, motivos y recomendaciones de una comuna: de comunas.json (contrato 0.8, las 345) o, si no está, del piloto. */
const infoComuna = (id) => D.comunasPais?.porId.get(id) ?? CTX.alertas?.comunas?.find((c) => c.region_id === id) ?? null;
const comunasRegion = (reg) => (D.comunasPais ? D.comunasPais.comunas.filter((c) => regionDe(c.region_id) === reg) : CTX.alertas?.comunas ?? []);
/** Recomendaciones del horizonte elegido (contrato 0.8); con el contrato anterior, las del clima. */
const recsComuna = (c) => c?.recomendaciones?.[S.h] ?? c?.recomendaciones_clima ?? [];
const nCond = (c) => c.clima_ultimo_dia?.condiciones?.length ?? 0;
function panelClima() {
  const cs = comunasRegion(CTX.reg?.id ?? S.region).filter((c) => c.clima_ultimo_dia)
    .sort((a, b) => nCond(b) - nCond(a) || Number(b.fuego_activo) - Number(a.fuego_activo) || a.nombre.localeCompare(b.nombre, "es"));
  if (!cs.length) return `<p class="nota">No hay clima para esta región.</p>`;
  const fecha = cs[0].clima_ultimo_dia.fecha_clima;
  return `<p class="nota">Clima del último día observado (${esc(fFecha(fecha, { day: "numeric", month: "long", year: "numeric" }))}). Los umbrales y su fuente están en cada condición. Qué hacer: para el horizonte de ${esc(hNombre())}.</p>
    <ul class="clima-lista">${cs.map((c) => { const k = c.clima_ultimo_dia, recs = recsComuna(c); return `<li><button type="button" class="clima-nombre" data-comuna="${c.region_id}">${esc(c.nombre)}</button>
      <small>${dec(k.tmax, 1)} °C máx. &middot; humedad mín. ${dec(k.hrmin, 0)} % &middot; viento ${dec(k.viento_max_kmh, 0)} km/h &middot; ${plural(k.dias_sin_lluvia, "día", "días")} sin lluvia</small>
      ${c.fuego_activo ? chipTipo("fuego_activo") : ""}
      ${k.condiciones.length ? chipsCondiciones(k.condiciones) : `<small class="nota">Sin condiciones extremas.</small>`}
      ${c.motivos?.length ? `<details><summary>Por qué (${c.motivos.length})</summary>${listaMotivos(c.motivos)}</details>` : ""}
      ${recs.length ? `<details><summary>Qué hacer (${recs.length})</summary>${listaRecs(recs)}</details>` : ""}</li>`; }).join("")}</ul>`;
}
const etiquetaPestanaAlertas = () => (CTX.alertas?.listas?.[S.h]?.tipo_lista === "alertas" || !CTX.alertas?.listas?.[S.h] ? "Alertas" : "Prioridades");
const hayClima = () => comunasRegion(CTX.reg?.id ?? S.region).some((c) => c.clima_ultimo_dia);
const tabsRegion = () => [...(CTX.alertas ? [["alertas", etiquetaPestanaAlertas()]] : []), ...(hayClima() ? [["clima", "Clima"]] : []), ["comunas", "Comunas"], ...(S.vision ? [["incendios", "Incendios (ejemplo)"]] : [])];
function htmlRegion() {
  const reg = CTX.reg, r = CTX.r;
  const cuerpo = S.tab === "alertas" ? tarjetasAlertas() : S.tab === "clima" ? panelClima() : S.tab === "incendios" ? contenidoIncendios()
    : `${CTX.alertas ? "" : `<p class="nota">Fuera de Valparaíso hay riesgo, clima y qué hacer por comuna; los sectores de 1 km y las alertas son del piloto de la Región de Valparaíso.</p>`}${listaComunas(reg)}`;
  return `<button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Chile</button>
    <h1>${esc(reg.nombre)}</h1>${bloquePeriodo(r)}${tarjetasRiesgo(reg.comunas)}${bloqueActivos()}${pestanas(tabsRegion())}<div id="detalle">${cuerpo}</div>`;
}
const nombreSector = (p) => `Sector ${CTX.puestos?.get(p.sector_id) ?? "?"} de ${CTX.sect?.features.length ?? "?"}`;
const coordSector = (p) => `${Math.abs(p.lat).toFixed(3)}° S · ${Math.abs(p.lon).toFixed(3)}° O`;
function fichaSector(f) {
  const p = f.properties, h = S.h;
  const comp = [["Interfaz con viviendas", p.pct_interfaz], ["Pastizal", p.pct_pastizal], ["Bosque o matorral", p.pct_bosque_matorral], ["Cultivo", p.pct_cultivo], ["Construido", p.pct_construido]].filter(([, v]) => v > 0);
  return `<div class="ficha"><button type="button" class="boton claro volver-btn" data-sector-cerrar>&larr; Sectores de la comuna</button>
    <h2 class="ficha-t">${esc(nombreSector(p))}</h2>
    <p class="coord">${esc(coordSector(p))}</p>
    <p class="bajada">Percentil ${dec(p.percentil_en_comuna, 0)} dentro de la comuna &middot; ${dec(p.area_km2, 2)} km².</p>
    <div class="cifra-grande"><strong>${pctTxt(p.prob_fuego_24h, 2)}</strong><span>de probabilidad de foco en este sector en 24 h (un sector es chico, por eso la cifra es baja)</span></div>
    <dl class="datos-resumen">
      <div><dt>Si hay fuego en la comuna, que caiga en este sector</dt><dd>${pctTxt(p.prob_si_fuego_en_comuna, 1)}</dd></div>
      <div><dt>Si hay fuego aquí, que sea un incendio grande</dt><dd>${pctTxt(p.prob_incendio_grande, 1)}</dd></div></dl>
    <p class="nota">El modelo no predice dónde empieza un incendio: ordena dónde es más probable que caiga el fuego si lo hay y estima si sería grande.</p>
    <h2>Rasgos</h2>${chipsRasgos(p.rasgos) || `<p class="nota">Sin rasgos destacados.</p>`}
    ${comp.length ? `<p class="nota">${comp.map(([n, v]) => `${n} ${dec(v, 1)} %`).join(" &middot; ")} &middot; pendiente media ${dec(p.pendiente_media, 1)}°</p>` : ""}
    <h2>Historial</h2>
    <p class="nota">${p.dias_con_fuego ? `${p.dias_con_fuego} ${p.dias_con_fuego === 1 ? "día" : "días"} con fuego desde 2012, ${p.incendios_grandes} ${p.incendios_grandes === 1 ? "incendio grande" : "incendios grandes"}; último fuego el ${esc(fFecha(p.ultimo_fuego, { day: "numeric", month: "long", year: "numeric" }))}.` : "Sin fuego registrado desde 2012."}</p>
    <h2>Qué hacer (${esc(hNombre(h))})</h2>${listaRecs(p.recomendaciones?.[h]) || `<p class="nota">Sin recomendaciones para este horizonte.</p>`}</div>`;
}
function listaSectores(sect) {
  const top = [...sect.features].sort((a, b) => b.properties.percentil_en_comuna - a.properties.percentil_en_comuna).slice(0, 10);
  return `<p class="nota">Los 10 sectores con mayor orden dentro de la comuna. Toca uno en la lista o en el mapa.</p>
    <ol class="lista-cola">${top.map((f, n) => { const p = f.properties; return `<li style="--i:${n}"><button type="button" data-sector="${p.sector_id}" aria-pressed="${p.sector_id === S.sector}">
      <span class="prio">${n + 1}</span><span class="que"><strong>${esc(nombreSector(p))}</strong><small>${esc((p.rasgos ?? []).map(textoRasgo).join(", ") || "sin rasgos destacados")}</small></span>
      <span class="valor">p${dec(p.percentil_en_comuna, 0)}<small>${pctTxt(p.prob_incendio_grande, 0)} grande</small></span></button></li>`; }).join("")}</ol>
    <label class="check"><input type="checkbox" id="ver-focos"${S.focos ? " checked" : ""}> Mostrar focos históricos de la comuna (desde 2012)</label>`;
}
const tabsComuna = () => [...(CTX.sect ? [["sectores", "Sectores"]] : []), ...(S.vision ? [["incendios", "Incendios (ejemplo)"]] : [])];
function htmlComuna() {
  const info = D.nombres[S.comuna], it = porComuna(CTX.r)[S.comuna], clima = infoComuna(S.comuna);
  const f = S.sector && CTX.sect?.features.find((x) => x.properties.sector_id === S.sector);
  // Qué hacer en la comuna (horizonte elegido): en Valparaíso va en el resumen, porque la columna derecha es de sectores;
  // en el resto del país ocupa la columna derecha.
  const recs = recsComuna(clima);
  const queHacer = clima ? `<h2>Qué hacer (${esc(hNombre())})</h2>${listaRecs(recs) || `<p class="nota">Sin recomendaciones para este horizonte: la comuna no está en nivel alto ni tuvo condiciones extremas de clima el último día.</p>`}` : "";
  // Sin modo visión no hay pestaña de incendios de ejemplo: una comuna sin sectores muestra qué hacer y su aviso.
  const cuerpo = S.tab === "incendios" && S.vision ? contenidoIncendios() : f ? fichaSector(f) : CTX.sect ? listaSectores(CTX.sect)
    : `<div class="sin-sectores">${queHacer}<p class="nota">Los sectores de 1 km y las alertas son del piloto de la Región de Valparaíso.</p></div>`;
  const k = clima?.clima_ultimo_dia;
  return `<div class="panel-cols"><div class="col-resumen">
      <button type="button" class="boton claro volver-btn" data-vista="region">&larr; Volver a la región</button>
      <h1>${esc(info.nombre)}</h1><p class="bajada">${esc(info.region)}</p>
      ${bloquePeriodo(CTX.r)}
      <div class="cifra-grande"><strong>${fp(it?.p)}</strong>${chipNivel(it?.nivel)}${clima?.fuego_activo ? chipTipo("fuego_activo") : ""}<span>de probabilidad de al menos un foco en la comuna (${esc(hNombre())})</span></div>
      ${bloqueActivos(false)}
      ${clima?.motivos?.length ? `<h2>Por qué</h2>${listaMotivos(clima.motivos)}` : ""}
      ${k ? `<h2>Clima del ${esc(fFecha(k.fecha_clima, { day: "numeric", month: "long" }))}</h2><p class="nota">${dec(k.tmax, 1)} °C máx. &middot; humedad mín. ${dec(k.hrmin, 0)} % &middot; viento ${dec(k.viento_max_kmh, 0)} km/h &middot; ${plural(k.dias_sin_lluvia, "día", "días")} sin lluvia</p>${chipsCondiciones(k.condiciones)}` : ""}
      ${CTX.sect ? queHacer : ""}
      ${regionDe(S.comuna) !== "05" && D.comunasPais?.nota ? `<p class="nota chica">${esc(D.comunasPais.nota)}</p>` : ""}
    </div>
    <div class="col-detalle">${pestanas(tabsComuna())}<div id="detalle">${cuerpo}</div></div></div>`;
}
const htmlPanel = () => (S.vista === "comuna" ? htmlComuna() : S.vista === "region" ? htmlRegion() : htmlPais());
/** Repinta solo el panel (pestaña, incendio o sector elegido), sin tocar el mapa. */
function repintarPanel(alInicio = false) {
  const p = $("#panel");
  if (!p) return;
  const col = S.vista === "comuna" ? () => document.querySelector(".col-detalle") : () => p;
  const y = col()?.scrollTop ?? 0;
  p.innerHTML = htmlPanel();
  p.classList.remove("refresca"); void p.offsetWidth; p.classList.add("refresca");
  if (col()) col().scrollTop = alInicio ? 0 : y;
}

// ------------------------------------------------------------------ país: una comuna, un color, y los incendios de ejemplo encima si el modo visión está encendido
const marcoVista = (clase, aria, leyenda, extra = "") => `<div class="vista-mapa ${clase}">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="${aria}"></div><div id="leyenda-caja">${leyenda}</div>${extra}
      ${S.vision ? `<div class="mapa-ejemplo">Incendios de ejemplo: las probabilidades no son del modelo</div>` : ""}</div>
    <aside class="lateral" id="panel"></aside></div>`;
function limitesZona() {
  const pts = (D.inc[S.dia]?.incendios ?? []).map((i) => [i.lat, i.lon]);
  return pts.length ? L.latLngBounds(pts).pad(0.3) : L.latLngBounds(LIMITES_CHILE);
}
async function vistaPais() {
  const [r] = await Promise.all([riesgo(), incendios(), activos()]);
  CTX = { r, regs: D.regs[S.h] };
  const pc = porComuna(r);
  const zoom = S.vision ? `<button type="button" class="mapa-zoom" id="mapa-zoom">${S.paisTodo ? "Ver zona de incendios" : "Ver todo Chile"}</button>` : "";
  $("#contenido").innerHTML = marcoVista("pais", "Mapa de Chile con el nivel de riesgo de cada comuna", leyendaNiveles(r), zoom);
  $("#panel").innerHTML = htmlPais();
  nuevoMapa("pais", S.vision && !S.paisTodo ? limitesZona() : LIMITES_CHILE);
  const deRegion = {};
  L.geoJSON(D.contornos, {
    filter: (f) => pc[f.properties.region_id] != null,
    style: (f) => estiloComuna(pc[f.properties.region_id].nivel, false),
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = pc[id], reg = regionDe(id);
      (deRegion[reg] ??= []).push(capa);
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong> (${esc(nombreCorto(f.properties.region))})<br>${fp(it.p)} de probabilidad &middot; riesgo ${NIVEL_TXT[it.nivel].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => capa.setStyle(estiloComuna(it.nivel, true)));
      capa.on("mouseout", () => capa.setStyle(estiloComuna(it.nivel, false)));
      capa.on("click", () => ir({ region: reg }));
    },
  }).addTo(mapa);
  pintarActivos(); pintarFuegos(); pintarDetalle();
  pintarMarco();
}

// ------------------------------------------------------------------ región: comunas coloreadas, y en Valparaíso las alertas y el clima
async function vistaRegion() {
  const [r] = await Promise.all([riesgo(), incendios(), activos(), comunasPais()]);
  const reg = D.regs[S.h].find((g) => g.id === S.region);
  if (!reg) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Región no encontrada</h1><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(); return; }
  const con = await conSectores();
  const tiene = reg.comunas.some((c) => con.has(c.region_id));
  // Las recomendaciones se piden siempre: desde el contrato 0.8 hay qué hacer en todas las comunas.
  const [alertas, rec] = await Promise.all([tiene ? back.alertas(S.region) : null, back.recomendaciones().catch(() => null)]);
  CTX = { r, reg, alertas, rec };
  if (!tabsRegion().some(([id]) => id === S.tab)) S.tab = alertas ? "alertas" : "comunas";
  $("#contenido").innerHTML = marcoVista("region", "Mapa de la región con el nivel de riesgo de sus comunas", leyendaNiveles(r));
  $("#panel").innerHTML = htmlRegion();
  const feats = reg.comunas.map((i) => geoDe(i.region_id)).filter(Boolean);
  const enTierra = feats.filter(esContinental);
  nuevoMapa("region:" + reg.id, L.geoJSON(enTierra.length ? enTierra : feats).getBounds(), { paddingBottomRight: [8, 70] });
  const pc = porComuna(r);
  L.geoJSON({ type: "FeatureCollection", features: feats }, {
    style: (f) => ({ ...estiloComuna(pc[f.properties.region_id].nivel, false), color: "#0b0b0b", weight: 1.3 }),
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = pc[id];
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong><br>${fp(it.p)} de probabilidad &middot; riesgo ${NIVEL_TXT[it.nivel].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => capa.setStyle({ weight: 3, fillOpacity: 0.8 }));
      capa.on("mouseout", () => capa.setStyle({ weight: 1.3, fillOpacity: 0.55 }));
      capa.on("click", () => ir({ comuna: id }));
    },
  }).addTo(mapa);
  // Los sectores de las alertas, numerados en el orden de las tarjetas.
  (alertas?.horizontes?.[S.h] ?? []).forEach((x, n) => {
    L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "mk-alerta", html: `<span>${n + 1}</span>`, iconSize: [26, 26] }) }).addTo(capaAlertas)
      .bindTooltip(`<strong>${n + 1}. ${esc(x.comuna)}</strong><br>${TIPO_ALERTA[x.tipo] ? esc(TIPO_ALERTA[x.tipo].etiqueta) + " · " : ""}riesgo ${NIVEL_TXT[x.nivel_comuna].toLowerCase()}`).on("click", () => ir({ comuna: x.region_id, sector: x.sector_id }));
  });
  pintarActivos(); pintarFuegos();
  pintarMarco();
}

// ------------------------------------------------------------------ comuna: sectores coloreados por su orden dentro de la comuna
const estiloSector = (p, sel) => ({ color: sel ? "#0b0b0b" : COLORES_S[claseSector(p.percentil_en_comuna)], weight: sel ? 3.5 : 0.8, opacity: 0.95, fillColor: COLORES_S[claseSector(p.percentil_en_comuna)], fillOpacity: sel ? 0.7 : 0.5 });
function marcarSector() {
  for (const [id, capa] of Object.entries(capas)) { capa.setStyle(estiloSector(capa.feature.properties, id === S.sector)); if (id === S.sector) capa.bringToFront(); }
}
function elegirSector(id) {
  S.sector = id; S.tab = "sectores";
  fijarHash(); marcarSector(); repintarPanel(true);
  if (id && capas[id]) mapa.fitBounds(capas[id].getBounds(), { padding: [80, 80], maxZoom: 15, animate: false });
}
async function vistaComuna() {
  const [r] = await Promise.all([riesgo(), incendios(), activos(), comunasPais()]);
  const id = S.comuna, info = D.nombres[id];
  if (!info) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Comuna no encontrada</h1><p>El código ${esc(id)} no está entre los contornos.</p><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(); return; }
  const man = await back.manifest(), tiene = (man.sectores?.regiones ?? []).includes(id);
  const [sect, alertas, rec] = await Promise.all([tiene ? back.sectores(id) : null, tiene ? back.alertas(regionDe(id)) : null, back.recomendaciones().catch(() => null)]);
  // Puesto de cada sector dentro de la comuna (1 = mayor percentil): se calcula una vez para que lista, ficha y mapa coincidan.
  const puestos = new Map([...(sect?.features ?? [])]
    .sort((a, b) => b.properties.percentil_en_comuna - a.properties.percentil_en_comuna)
    .map((f, i) => [f.properties.sector_id, i + 1]));
  CTX = { r, sect, alertas, rec, puestos };
  if (!tabsComuna().some(([t]) => t === S.tab)) S.tab = sect ? "sectores" : S.vision ? "incendios" : null;
  if (S.sector && !sect?.features.some((f) => f.properties.sector_id === S.sector)) S.sector = null;
  const nota = tiene ? `<div class="nota-mapa"><strong>Sobre el modelo de sectores</strong>${esc(man.sectores.modelo_b?.nota ?? "")}</div>` : "";
  $("#contenido").innerHTML = marcoVista("comuna", "Mapa de la comuna con sus sectores", sect ? leyendaSectores() : leyendaNiveles(r), nota);
  $("#panel").innerHTML = htmlComuna();
  const contorno = L.geoJSON(geoDe(id), { style: { color: "#0b0b0b", weight: 2.5, fill: false }, interactive: false });
  nuevoMapa("comuna:" + id, contorno.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 84] });
  if (sect) {
    L.geoJSON(sect, {
      style: (f) => estiloSector(f.properties, f.properties.sector_id === S.sector),
      onEachFeature: (f, capa) => {
        const p = f.properties; capas[p.sector_id] = capa;
        capa.bindTooltip(`<strong>${esc(nombreSector(p))}</strong><br>Percentil ${dec(p.percentil_en_comuna, 0)} en la comuna<br>${pctTxt(p.prob_fuego_24h, 2)} de foco en 24 h`, { sticky: true });
        capa.on("click", () => elegirSector(p.sector_id));
      },
    }).addTo(mapa);
  } else {
    const it = porComuna(r)[id];
    L.geoJSON(geoDe(id), { style: estiloComuna(it?.nivel ?? "bajo", false), interactive: false }).addTo(mapa);
  }
  contorno.addTo(mapa).bringToFront();
  pintarActivos(); pintarFuegos(); pintarDetalle(); pintarFocos();
  if (S.sector && capas[S.sector]) mapa.fitBounds(capas[S.sector].getBounds(), { padding: [80, 80], maxZoom: 15, animate: false });
  pintarMarco();
}

// ------------------------------------------------------------------ metodología y fuentes
async function vistaMetodologia() {
  let r = null, rec = null, man = null;
  try { r = await back.riesgo(S.h); rec = await back.recomendaciones(); man = await back.manifest(); } catch { /* sin datos: igual se muestra el texto */ }
  const datos = man?.datos ?? null, av = (await activos())?.validacion ?? null;
  mapa?.remove(); mapa = null; ultimaVista = null; capaFuegos = capaDetalle = capaFocos = capaAlertas = capaActivos = null;
  // Cifras de la zona de avance: del archivo del back si llegó; si no, las de la validación publicada con el contrato 0.7.
  const km = (k, v) => dec(av?.radios_km?.[k] ?? v, 1), pc = (k, v) => Math.round(av?.cobertura_prueba_pct?.[k] ?? v);
  const fuentesRec = Object.values(rec?.fuentes ?? {});
  $("#contenido").innerHTML = `<div class="texto-largo"><button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al mapa</button><h1>Metodología y fuentes</h1>
    <p>Preaviso apoya a quien decide dónde poner recursos de prevención contra incendios: muestra qué comunas tienen más riesgo, dónde es más probable que caiga el fuego dentro de cada comuna si lo hay, por qué, y qué hacer.</p>
    <h2>De dónde salen los números</h2>
    <p>Todo sale del back (contrato ${esc(man?.contrato ?? "")}, <a href="https://marcelo-corro.github.io/aivital-incendios-datos/">marcelo-corro.github.io/aivital-incendios-datos</a>): riesgo por comuna, alertas, sectores y recomendaciones. La plataforma no inventa números en el flujo principal.${r ? ` El modelo es <code>${esc(r.modelo)}</code>.` : ""}</p>
    <h2>Fecha de los datos</h2>
    <p>El riesgo es para ${r ? `el ${esc(periodoTxt(r.periodo))}` : "el día de hoy"} y se calcula con datos que llegan hasta el día anterior. ${esc(datos?.nota ?? "")}${datos?.prueba_nueva ? ` En 2026 (ene-oct), con datos que no existían cuando se eligió el modelo: AUC ${esc(dec(datos.prueba_nueva.auc, 3))} (climatología ${esc(dec(datos.prueba_nueva.auc_climatologia, 3))}).` : ""} Se puede elegir entre 24 horas, 48 horas y 7 días. El de 7 días es orientativo: supera poco a la climatología.</p>
    <h2>Niveles</h2>
    <p>Cada archivo trae el nivel de cada comuna (bajo, medio, alto, muy alto) con los cortes propios de su horizonte. Por eso no se compara la probabilidad entre horizontes.</p>
    <h2>País, región, comuna y sectores</h2>
    <p>El mapa del país pinta cada comuna con su nivel. Al entrar a una región se ven sus comunas y el clima de cada una; en Valparaíso, además, las tarjetas de alertas (en el orden en que las publica el back). En cada comuna del país hay clima del último día observado, motivos verificables del nivel y qué hacer en el horizonte elegido: por el clima de ese día y, si la comuna está en nivel alto o muy alto, avisar al 130. Son las mismas reglas del piloto de Valparaíso; la restricción de quemas se nombra solo en esa región y en el resto, el calendario de quemas de CONAF. Al entrar a una comuna de Valparaíso se ven además sus sectores de aproximadamente 1 km², coloreados por su percentil dentro de la comuna.</p>
    <p>El modelo de sectores no predice dónde empieza un incendio: ordena dónde es más probable que caiga el fuego si lo hay y estima si sería grande. La probabilidad de foco de un sector es baja porque un sector es chico.</p>
    <h2>Incendios activos y zona probable de avance</h2>
    <p>Los incendios activos son los focos satelitales VIIRS de NASA FIRMS de los últimos 3 días, agrupados por incendio; en Valparaíso se sacan las fuentes persistentes (industria) que marca el piloto de sectores. Se ven en los mapas del país, la región y la comuna, y en la portada. En el horizonte de 24 h, alrededor del centro de los focos más recientes de cada incendio se dibujan dos círculos: en la prueba ${esc(av?.periodo_prueba ?? "2022-2026")}, con años que no se usaron para calibrar, el frente nuevo del día siguiente cayó dentro de ${km("p75", 2.53)} km el ${pc("p75", 68.9)} % de las veces y dentro de ${km("p90", 3.63)} km el ${pc("p90", 85.4)} %.</p>
    <p>El viento sale de NASA POWER (dirección WD10M y velocidad WS10M, media diaria a 10 m) y llega con unos días de rezago: la ficha de cada incendio dice de qué día es. La flecha aparece solo con viento fuerte (desde ${dec(av?.viento_fuerte_desde_ms ?? 3.18, 1)} m/s): ahí el avance siguió al viento el ${Math.round(av?.acierto_45_viento_fuerte_prueba_pct ?? 35.7)} % de las veces, contra ${Math.round(av?.acierto_45_azar_pct ?? 25)} % al azar. Con viento suave la dirección casi no se distingue del azar, por eso no se dibuja un cono. Los círculos y la flecha se ven solo en 24 h, porque la validación es del avance del día siguiente; en 48 h y 7 días se muestran solo los incendios. La validación completa está en el repositorio del back (<code>docs/avance_validacion.md</code>).</p>
    ${VISION ? `<h2>Modo visión (datos de ejemplo)</h2>
    <p>Apagado por defecto. Muestra incendios del registro de CONAF del 16 al 18 de enero de 2026 con una probabilidad de no control, factores y activos <strong>inventados</strong>: no son del modelo y cada pantalla lo dice con una etiqueta grande. La zona de avance de esos incendios no es inventada: son los mismos dos círculos validados de los incendios activos, sin cono. La probabilidad de no control es pariente de la probabilidad de incendio grande del back, que sí está validada; calcularla para enero de 2026 necesita focos satelitales de ese mes y datos de CONAF en tiempo real, que hoy no hay.</p>` : ""}
    <h2>Fuentes</h2>
    <ul>
      <li>NASA FIRMS. We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) <a href="https://earthdata.nasa.gov/firms">https://earthdata.nasa.gov/firms</a>.</li>
      <li>NASA POWER. The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division. The data was obtained from the POWER Project's Daily 2.10.3 version on 2026/11/14. Clima diario y viento (WD10M, WS10M) de la zona de avance. <a href="https://power.larc.nasa.gov/">https://power.larc.nasa.gov/</a></li>
      <li>Biblioteca del Congreso Nacional de Chile. División comunal: polígonos de las comunas. <a href="https://www.bcn.cl/siit/mapas_vectoriales">https://www.bcn.cl/siit/mapas_vectoriales</a>. Material referencial.</li>
      <li>Equipo AIVital. Datos del contrato ${esc(man?.contrato ?? "")}. <a href="https://github.com/marcelo-corro/aivital-incendios-datos">https://github.com/marcelo-corro/aivital-incendios-datos</a></li>
      <li>CONAF. Registro de incendios forestales (capa incendios_totales), datos públicos bajados el 14 de noviembre de 2026. <a href="https://www.conaf.cl/">https://www.conaf.cl/</a></li>
      <li>Esri, Maxar, Earthstar Geographics y la comunidad de usuarios de SIG. World Imagery: imagen satelital del mapa base. <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9</a></li>
      ${fuentesRec.map((f) => `<li>${esc(f.nombre)}. <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a></li>`).join("")}
    </ul></div>`;
  pintarMarco();
}

// ------------------------------------------------------------------ navegación y eventos
function ir(cambio) {
  // Al cambiar de nivel o de horizonte se suelta el incendio elegido, salvo que el cambio lo traiga (por ejemplo "Ver en su comuna").
  const n = { dia: S.dia, h: S.h, region: S.region, comuna: S.comuna, vista: null, incendio: null, sector: null, ...cambio };
  if ("region" in cambio && !("comuna" in cambio)) n.comuna = null;
  if (n.vista === "pais") { n.region = null; n.comuna = null; }
  if (n.vista === "region") n.comuna = null;
  if (n.comuna) n.region = regionDe(n.comuna);
  if (!n.comuna) n.sector = null;
  if (location.hash === hashDe(n)) { pintar(); return; }
  location.hash = hashDe(n);
}

async function pintar() {
  const h = leerHash(location.hash), q = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (h.comuna !== S.comuna) S.focos = false;
  S.h = horizonteValido(q.get("h")); S.dia = diaValido(h.dia); S.region = h.region; S.comuna = h.comuna; S.inc = h.incendio;
  S.sector = h.comuna && /^\d{5}_-?\d+_-?\d+$/.test(q.get("sector") ?? "") ? q.get("sector") : null;
  if (S.inc && !S.vision) { if (VISION) { S.vision = true; guardar("preaviso.vision", true); } else S.inc = null; }
  S.vista = h.vista === "metodologia" ? "metodologia" : h.comuna ? "comuna" : h.region ? "region" : "pais";
  const validas = { pais: ["incendios"], region: ["alertas", "clima", "comunas", "incendios"], comuna: ["sectores", "incendios"] }[S.vista];
  if (validas && !validas.includes(S.tab)) S.tab = null;
  if (S.inc) S.tab = "incendios";
  try {
    if (S.vista === "metodologia") await vistaMetodologia();
    else {
      await (S.vista === "comuna" ? vistaComuna() : S.vista === "region" ? vistaRegion() : vistaPais());
      const i = S.inc && aqui().find((x) => x.id === S.inc);
      if (S.inc && !i) { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }
      else if (i) { repintarPanel(true); pintarDetalle(); acercar(i); }
      animarCifras($("#contenido"));
    }
  } catch (e) {
    console.error(e);
    $("#contenido").innerHTML = `<div class="texto-largo"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p><p class="nota">Los datos salen del back (${esc(CONFIG.BASE_CONTRATO)}). No se muestran datos inventados en su lugar.</p></div>`;
  }
}

document.addEventListener("click", (e) => {
  const hz = e.target.closest("[data-h]");
  if (hz) { ir({ h: hz.dataset.h, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  const act = e.target.closest("[data-activo]");
  if (act) { verActivo(act.dataset.activo); return; }
  if (e.target.closest("[data-vision]")) {
    S.vision = !S.vision; guardar("preaviso.vision", S.vision);
    ir({ vista: S.vista === "metodologia" ? "metodologia" : null }); return;
  }
  const dia = e.target.closest("[data-dia]");
  if (dia) { ir({ dia: dia.dataset.dia, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  const v = e.target.closest("[data-vista]");
  if (v) { e.preventDefault(); if (!v.disabled) ir({ vista: v.dataset.vista }); return; }
  const tg = e.target.closest("[data-toggle]");
  if (tg) { const id = tg.dataset.toggle; if (!S.abiertas.delete(id)) S.abiertas.add(id); pintarArbol(); return; }
  if (e.target.closest("#mapa-zoom")) {
    S.paisTodo = !S.paisTodo;
    mapa?.flyToBounds(S.paisTodo ? LIMITES_CHILE : limitesZona(), { duration: 0.9 });
    $("#mapa-zoom").textContent = S.paisTodo ? "Ver zona de incendios" : "Ver todo Chile";
    return;
  }
  const r = e.target.closest("[data-region]");
  if (r) { S.abiertas.add(r.dataset.region); ir({ region: r.dataset.region }); return; }
  const vc = e.target.closest("[data-ver-comuna]");
  if (vc) { ir({ comuna: vc.dataset.verComuna, incendio: vc.dataset.incendioIr }); return; }
  const sc = e.target.closest("[data-comuna][data-sector]");
  if (sc) { ir({ comuna: sc.dataset.comuna, sector: sc.dataset.sector }); return; }
  const c = e.target.closest("[data-comuna]");
  if (c) { ir({ comuna: c.dataset.comuna }); return; }
  const sec = e.target.closest("[data-sector]");
  if (sec) { elegirSector(sec.dataset.sector); return; }
  if (e.target.closest("[data-sector-cerrar]")) { elegirSector(null); return; }
  const inc = e.target.closest("[data-incendio]");
  if (inc) { elegirIncendio(inc.dataset.incendio); return; }
  if (e.target.closest("[data-inc-cerrar]")) { cerrarIncendio(); return; }
  const t = e.target.closest("[data-tab]");
  if (t) { S.tab = t.dataset.tab; repintarPanel(true); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "ver-focos") { S.focos = e.target.checked; pintarFocos(); }
  if (e.target.id === "buscar") {
    const t = e.target.value.trim().toLowerCase();
    const id = Object.keys(D.nombres).find((k) => `${D.nombres[k].nombre} (${nombreCorto(D.nombres[k].region)})`.toLowerCase() === t)
      ?? Object.keys(D.nombres).find((k) => D.nombres[k].nombre.toLowerCase() === t);
    if (id) ir({ comuna: id });
  }
});

window.addEventListener("hashchange", pintar);
if (!location.hash) history.replaceState(null, "", hashDe({ dia: S.dia }));
pintar();
