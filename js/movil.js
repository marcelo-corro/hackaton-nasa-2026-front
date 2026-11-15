// Vista de terreno. Es la misma lógica de la plataforma web, mostrada para otra persona:
// quien está en el lugar y tiene que hacer las acciones. Corre en el navegador y dentro de la app de Android.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { evaluar, priorizar, alertas, PESOS_FABRICA, NOMBRE_ESTADO } from "./logica.js";
import { $, esc, leer, guardar } from "./util.js";

// La vista de terreno lee todo del servidor de la organización: no depende de que el teléfono llegue a internet.
CONFIG.FUENTE = "maqueta";
CONFIG.BASE_CONTRATO = CONFIG.BASE_MAQUETA;

const CADA_MS = 60000;                                   // cada cuánto se vuelve a leer el pronóstico
const nativo = () => Boolean(window.Capacitor?.isNativePlatform?.());
const avisosNativos = () => window.Capacitor?.Plugins?.LocalNotifications;

const estado = { pestana: "pendientes", rol: leer("preaviso.rol", "todos"), lista: [], leido: null, error: null, respaldo: false, inventado: true };

// ---------- datos ----------
async function cargar() {
  const [pronostico, puntos, protocolos] = await Promise.all([api.pronostico(), api.puntos(), api.protocolos()]);
  const umbrales = leer("preaviso.umbrales", {});
  for (const p of protocolos.items) Object.assign(p, umbrales[p.id] || {});
  const pronPorComuna = Object.fromEntries(pronostico.items.map((it) => [it.region_id, it]));
  const avisos = evaluar(protocolos.items, puntos.items, pronPorComuna);
  const prioridad = priorizar(pronostico, puntos.items, { ...PESOS_FABRICA, ...leer("preaviso.pesos", {}) });
  estado.lista = alertas(avisos, prioridad);
  estado.inventado = Boolean(pronostico.inventado || pronostico.ejemplo || puntos.ejemplo);
  estado.leido = new Date();
  estado.error = null;
}

async function actualizar({ avisar = true } = {}) {
  try {
    await cargar();
  } catch (e) {
    // Sin conexión con el servidor de la organización: se muestran los datos que la app trae guardados.
    if (CONFIG.SERVIDOR && !estado.respaldo) {
      estado.respaldo = true;
      CONFIG.BASE_EXT = "datos/ext/"; CONFIG.BASE_MAQUETA = "datos/";
      if (CONFIG.FUENTE === "maqueta") CONFIG.BASE_CONTRATO = "datos/";
      return actualizar({ avisar });
    }
    estado.error = e.message;
  }
  if (avisar && !estado.error) avisarNuevas();
  pintar();
}

// ---------- avisos al teléfono ----------
const hechas = () => leer("preaviso.hechas", {});
const accionesDe = (a) => (estado.rol === "todos" ? a.acciones : a.acciones.filter((ac) => ac.quien === estado.rol));
const terminada = (a) => { const h = hechas(); const acs = accionesDe(a); return acs.length > 0 && acs.every((ac) => h[ac.clave]); };
const visibles = () => estado.lista.filter((a) => accionesDe(a).length);

async function notificar(titulo, cuerpo) {
  navigator.vibrate?.([350, 150, 350, 150, 350]);
  const n = avisosNativos();
  if (nativo() && n) {
    try {
      await n.createChannel?.({ id: "alertas", name: "Alertas de Preaviso", description: "Acciones por activar o preparar", importance: 5, visibility: 1, vibration: true });
      await n.schedule({ notifications: [{ id: Math.floor(Date.now() % 2000000000), title: titulo, body: cuerpo, channelId: "alertas" }] });
      return "enviada al teléfono";
    } catch (e) { return `no se pudo enviar al teléfono: ${e.message}`; }
  }
  if ("Notification" in window && Notification.permission === "granted") { new Notification(titulo, { body: cuerpo, icon: "img/marca.svg" }); return "enviada al navegador"; }
  return "mostrada solo en pantalla: faltan los permisos de aviso";
}

function avisarNuevas() {
  const actuales = visibles().filter((a) => !terminada(a));
  const vistas = leer("preaviso.alertas-vistas", null);
  const nuevas = vistas ? actuales.filter((a) => !vistas.includes(a.id)) : actuales;
  guardar("preaviso.alertas-vistas", actuales.map((a) => a.id));
  if (!nuevas.length) return;
  const act = nuevas.filter((a) => a.estado === "activacion").length;
  const titulo = nuevas.length === 1 ? nuevas[0].titulo : `${nuevas.length} alertas nuevas${act ? `, ${act} por activar hoy` : ""}`;
  const cuerpo = nuevas.length === 1 ? `${nuevas[0].punto.comuna}. ${nuevas[0].motivo}.` : nuevas.slice(0, 3).map((a) => a.punto.nombre).join(", ") + (nuevas.length > 3 ? " y más" : "");
  notificar(titulo, cuerpo);
  $("#m-nueva").innerHTML = `${esc(titulo)}<br><span style="font-weight:400">${esc(cuerpo)}</span><button id="m-cerrar-nueva">Entendido</button>`;
  $("#m-nueva").hidden = false;
}

async function pedirPermiso() {
  const n = avisosNativos();
  if (nativo() && n) { const r = await n.requestPermissions(); return r.display; }
  if ("Notification" in window) return Notification.requestPermission();
  return "no disponible";
}

// ---------- pantalla ----------
function tarjeta(a) {
  const h = hechas();
  const acciones = accionesDe(a).map((ac) => `<li><label><input type="checkbox" data-hecha="${esc(ac.clave)}" ${h[ac.clave] ? "checked" : ""}>
      <span class="texto">${esc(ac.texto)}</span><span class="quien">${esc(ac.quien)}</span></label></li>`).join("");
  const mensaje = `Preaviso. ${a.titulo} (${a.punto.comuna}). ${a.motivo}. Acciones: ${accionesDe(a).map((ac) => ac.texto).join("; ")}.${estado.inventado ? " MAQUETA: datos inventados." : ""}`;
  return `<article class="alerta est-${a.estado}">
    <div class="alerta-cabeza"><span class="chip">${NOMBRE_ESTADO[a.estado]}</span><span class="alerta-prioridad">Prioridad <strong>${a.prioridad}</strong></span></div>
    <h2>${esc(a.punto.nombre)}</h2>
    <p class="alerta-lugar">${esc(a.punto.comuna)}, ${a.punto.personas} personas. A cargo: ${esc(a.punto.responsable)}.</p>
    <p class="alerta-motivo">${esc(a.motivo)}. Confianza ${esc(a.confianza)}.</p>
    <ul class="m-acciones">${acciones}</ul>
    <p class="alerta-freno">${a.frenos.map(esc).join(" ")}</p>
    <div class="alerta-pie"><a class="m-boton" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensaje)}">Avisar por WhatsApp</a></div>
  </article>`;
}

function vistaLista(lista, vacio) {
  if (estado.error) return `<div class="m-vacio"><strong>No se pudieron leer los datos.</strong><p>${esc(estado.error)}</p><p><button class="m-boton" id="m-reintentar">Reintentar</button></p></div>`;
  return lista.length ? lista.map(tarjeta).join("") : `<p class="m-vacio">${vacio}</p>`;
}

function vistaAjustes() {
  const roles = [...new Set(estado.lista.flatMap((a) => a.acciones.map((ac) => ac.quien)))].sort();
  return `<section class="m-ajuste"><h2>Mi rol</h2><p class="nota">Elige tu rol para ver solo las acciones que te tocan.</p>
      <label for="m-rol">Rol</label><select id="m-rol"><option value="todos">Todos los roles</option>${roles.map((r) => `<option ${r === estado.rol ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></section>
    <section class="m-ajuste"><h2>Avisos en este teléfono</h2>
      <p class="nota">La app revisa el pronóstico cada minuto mientras está abierta y avisa con vibración cuando aparece una alerta nueva. Con la app cerrada el aviso llega por WhatsApp.</p>
      <div class="fila"><button class="m-boton" id="m-permiso">Permitir avisos</button><button class="m-boton fuerte" id="m-probar">Probar una alerta</button></div>
      <p class="nota" id="m-estado-aviso" role="status"></p></section>
    <section class="m-ajuste"><h2>De dónde vienen los datos</h2>
      <p class="nota">${estado.respaldo ? "Sin conexión con el servidor. Se muestran los datos guardados en la app." : CONFIG.SERVIDOR ? `Servidor: ${esc(CONFIG.SERVIDOR)}` : "Datos de la misma página."} ${estado.leido ? `Última lectura a las ${estado.leido.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}.` : ""}</p>
      <label for="m-servidor">Dirección del servidor de tu organización</label><input id="m-servidor" type="url" inputmode="url" placeholder="http://servidor:7093/" value="${esc(CONFIG.SERVIDOR)}">
      <div class="fila"><button class="m-boton" id="m-guardar-servidor">Guardar y recargar</button><button class="m-boton" id="m-actualizar">Leer ahora</button></div></section>
    <section class="m-ajuste"><h2>Plataforma completa</h2><p><a class="m-boton" href="index.html">Abrir el parte, el mapa y los protocolos</a></p></section>`;
}

function pintar() {
  const lista = visibles();
  const pendientes = lista.filter((a) => !terminada(a));
  const listas = lista.filter(terminada);
  const act = pendientes.filter((a) => a.estado === "activacion").length;
  $("#m-resumen").innerHTML = estado.error ? "Sin datos" : pendientes.length
    ? `<strong>${act}</strong> por activar hoy y <strong>${pendientes.length - act}</strong> por preparar${estado.rol === "todos" ? "" : `, para ${esc(estado.rol)}`}`
    : "Nada pendiente para hoy";
  $("#m-n-pendientes").textContent = pendientes.length || "";
  $("#m-n-hechas").textContent = listas.length || "";
  $("#m-aviso-datos").textContent = "Maqueta: el pronóstico y los puntos son inventados.";
  $("#m-aviso-datos").hidden = !estado.inventado;
  document.querySelectorAll("[data-pestana]").forEach((b) => b.setAttribute("aria-current", b.dataset.pestana === estado.pestana ? "page" : "false"));
  $("#m-contenido").innerHTML = estado.pestana === "ajustes" ? vistaAjustes()
    : estado.pestana === "hechas" ? `<h1 class="m-titulo">Alertas con todas sus acciones hechas</h1>${vistaLista(listas, "Todavía no terminas ninguna alerta.")}`
      : `<h1 class="m-titulo">Ordenadas por urgencia y prioridad</h1>${vistaLista(pendientes, "No hay acciones pendientes con los umbrales actuales.")}`;
}

document.addEventListener("click", async (e) => {
  const p = e.target.closest("[data-pestana]");
  if (p) { estado.pestana = p.dataset.pestana; pintar(); window.scrollTo(0, 0); return; }
  const id = e.target.id;
  if (id === "m-cerrar-nueva") { $("#m-nueva").hidden = true; return; }
  if (id === "m-reintentar" || id === "m-actualizar") { await actualizar(); return; }
  if (id === "m-permiso") { $("#m-estado-aviso").textContent = `Permiso de avisos: ${await pedirPermiso()}.`; return; }
  if (id === "m-probar") {
    const a = visibles()[0];
    const r = await notificar(a ? `Prueba. ${a.titulo}` : "Prueba de alerta de Preaviso", a ? `${a.punto.comuna}. ${a.motivo}.` : "Así llega una alerta nueva.");
    $("#m-estado-aviso").textContent = `Alerta de prueba ${r}.`;
    return;
  }
  if (id === "m-guardar-servidor") {
    const v = $("#m-servidor").value.trim();
    if (v) localStorage.setItem("preaviso.servidor", v); else localStorage.removeItem("preaviso.servidor");
    location.reload();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.hecha) {
    const h = hechas();
    h[e.target.dataset.hecha] = e.target.checked;
    guardar("preaviso.hechas", h);
    // se deja ver la marca un momento antes de mover la alerta a "Hechas"
    setTimeout(pintar, 450);
  }
  if (e.target.id === "m-rol") { estado.rol = e.target.value; guardar("preaviso.rol", estado.rol); pintar(); }
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) actualizar(); });
setInterval(() => { if (!document.hidden) actualizar(); }, CADA_MS);
if (nativo()) pedirPermiso().catch(() => {});
actualizar();
