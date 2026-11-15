// Estado compartido y ayudas de formato. Lo usan app.js, vistas-datos.js y movil.js.
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const NIVEL = { bajo: "Bajo", medio: "Medio", alto: "Alto", muy_alto: "Muy alto" };
export const NIVEL_MES = { baja: "Baja", normal: "Normal", alta: "Alta", extrema: "Extrema" };

export const fFecha = (iso, opciones) => new Intl.DateTimeFormat("es-CL", opciones).format(new Date(iso + "T12:00:00"));
export const pct = (v) => (v == null ? "sin dato" : `${Math.round(v * 100)} %`);
export const num = (v, sufijo = "") => (v == null ? "sin dato" : `${String(v).replace(".", ",")}${sufijo}`);
/** Número con un decimal y coma. Un valor que falta se muestra con raya, como pide la guía del back. */
export const dec = (v, d = 1) => (v == null ? "—" : Number(v).toLocaleString("es-CL", { maximumFractionDigits: d }));
export const cuando = (d) => (d.dia === 1 ? "Mañana" : d.dia === 2 ? "Pasado mañana" : `El ${fFecha(d.fecha, { weekday: "long", day: "numeric" })}`);

export const leer = (clave, respaldo) => { try { return JSON.parse(localStorage.getItem(clave)) ?? respaldo; } catch { return respaldo; } };
export const guardar = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));

export const estado = { vista: "parte", dia: 1, capa: "foco", comuna: null, serie: "armonizado", desde: null, hasta: null, mes: null };
export const datos = {};
