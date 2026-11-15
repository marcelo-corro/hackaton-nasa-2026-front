// Reglas que convierten un pronóstico en avisos con acciones. Sin acceso a la página:
// se puede probar con node.

export const ORDEN_ESTADO = { activacion: 0, preparacion: 1, vigilancia: 2 };

export const NOMBRE_ESTADO = {
  activacion: "Activar hoy",
  preparacion: "Preparar hoy",
  vigilancia: "En vigilancia",
};

/**
 * Cruza protocolos, puntos y pronóstico por comuna.
 * Un punto entra en:
 *  - activación: el valor supera el umbral de activación dentro de los días de activación.
 *  - preparación: supera el umbral de preparación dentro de los días de preparación.
 *  - vigilancia: lo supera más adelante en la semana.
 */
export function evaluar(protocolos, puntos, pronPorComuna) {
  const avisos = [];
  for (const p of protocolos) {
    for (const x of puntos) {
      if (!p.aplica_a.includes(x.tipo)) continue;
      const pron = pronPorComuna[x.region_id];
      if (!pron) continue;
      const v = (d) => d[p.variable];
      const supera = (d, umbral) => v(d) != null && v(d) >= umbral;
      const act = pron.dias.find((d) => d.dia <= p.dias_activacion && supera(d, p.umbral_activacion));
      const prep = pron.dias.find((d) => d.dia <= p.dias_preparacion && supera(d, p.umbral_preparacion));
      const vig = pron.dias.find((d) => supera(d, p.umbral_preparacion));
      const dia = act || prep || vig;
      if (!dia) continue;
      const estado = act ? "activacion" : prep ? "preparacion" : "vigilancia";
      avisos.push({
        id: `${p.id}|${x.id}`,
        protocolo: p,
        punto: x,
        estado,
        dia,
        valor: v(dia),
        acciones: estado === "activacion" ? p.acciones_activacion : estado === "preparacion" ? p.acciones_preparacion : [],
      });
    }
  }
  avisos.sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.dia.dia - b.dia.dia || b.punto.personas - a.punto.personas);
  return avisos;
}

/** El peor estado de cada punto, para pintarlo en la tabla y el mapa. */
export function estadoPorPunto(avisos) {
  const peor = {};
  for (const a of avisos) {
    const actual = peor[a.punto.id];
    if (!actual || ORDEN_ESTADO[a.estado] < ORDEN_ESTADO[actual]) peor[a.punto.id] = a.estado;
  }
  return peor;
}

/** Para cada día: cuántos puntos superan el umbral de activación de algún protocolo. */
export function puntosSobreUmbralPorDia(protocolos, puntos, pronPorComuna, nDias) {
  const cuenta = Array(nDias).fill(0);
  for (const x of puntos) {
    const pron = pronPorComuna[x.region_id];
    if (!pron) continue;
    pron.dias.forEach((d, i) => {
      const alguno = protocolos.some((p) => p.aplica_a.includes(x.tipo) && d[p.variable] != null && d[p.variable] >= p.umbral_activacion);
      if (alguno) cuenta[i] += 1;
    });
  }
  return cuenta;
}

// ---------- prioridad: ordenar las situaciones por una suma ponderada de factores ----------

/** Los seis factores, con el texto que ve el usuario. Los pesos son una propuesta del equipo, no una medición. */
export const FACTORES = [
  { id: "foco", nombre: "Probabilidad de foco", ayuda: "Qué tan probable es que haya fuego en la comuna ese día. Llega al máximo con 50 %.", peso: 30 },
  { id: "exposicion", nombre: "Personas expuestas", ayuda: "Cuántas personas hay en tus puntos de esa comuna, frente a tu comuna con más personas.", peso: 25 },
  { id: "humo", nombre: "Humo esperado", ayuda: "Partículas finas de humo esperadas. Llega al máximo con 100 µg/m³.", peso: 15 },
  { id: "interfaz", nombre: "Casas junto a vegetación", ayuda: "Parte de la comuna donde se juntan viviendas y vegetación. Ahí parte la mayoría de los incendios.", peso: 10 },
  { id: "anticipacion", nombre: "Cercanía en el tiempo", ayuda: "Mañana pesa más que dentro de cinco días.", peso: 10 },
  { id: "confianza", nombre: "Confianza del pronóstico", ayuda: "Un pronóstico de confianza alta pesa más que uno de confianza baja.", peso: 10 },
];

export const PESOS_FABRICA = Object.fromEntries(FACTORES.map((f) => [f.id, f.peso]));
export const NOMBRE_PRIORIDAD = { alerta: "Alerta", atencion: "Atención", seguimiento: "Seguimiento" };
export const CORTE_PRIORIDAD = { alerta: 60, atencion: 40 };

const VALOR_CONFIANZA = { alta: 1, media: 0.6, baja: 0.3 };
const tope = (v) => Math.max(0, Math.min(1, v));

/** Valor de cada factor entre 0 y 1 para una comuna y un día. */
export function factoresDe(comuna, dia, personas, maxPersonas) {
  return {
    foco: tope((dia.prob_foco ?? 0) / 0.5),
    exposicion: maxPersonas ? tope(personas / maxPersonas) : 0,
    humo: tope((dia.pm25_humo ?? 0) / 100),
    interfaz: tope(comuna.interfaz ?? 0),
    anticipacion: tope(1 - (dia.dia - 1) * 0.2),
    confianza: VALOR_CONFIANZA[dia.confianza] ?? 0.3,
  };
}

/**
 * Una fila por comuna, con su día de mayor puntaje (0 a 100) y el aporte de cada factor.
 * Ordenadas de mayor a menor. Los pesos pueden sumar cualquier cosa: se normalizan.
 */
export function priorizar(pronostico, puntos, pesos = PESOS_FABRICA) {
  const personasPorComuna = {};
  const puntosPorComuna = {};
  for (const x of puntos) {
    personasPorComuna[x.region_id] = (personasPorComuna[x.region_id] || 0) + (x.personas || 0);
    (puntosPorComuna[x.region_id] ||= []).push(x);
  }
  const maxPersonas = Math.max(0, ...Object.values(personasPorComuna));
  const sumaPesos = FACTORES.reduce((s, f) => s + Math.max(0, pesos[f.id] ?? 0), 0) || 1;
  const filas = pronostico.items.map((comuna) => {
    const personas = personasPorComuna[comuna.region_id] || 0;
    let mejor = null;
    for (const dia of comuna.dias) {
      const valores = factoresDe(comuna, dia, personas, maxPersonas);
      const aportes = FACTORES.map((f) => ({ id: f.id, nombre: f.nombre, valor: valores[f.id], puntos: (100 * Math.max(0, pesos[f.id] ?? 0) * valores[f.id]) / sumaPesos }));
      const puntaje = aportes.reduce((s, a) => s + a.puntos, 0);
      if (!mejor || puntaje > mejor.puntaje) mejor = { dia, aportes, puntaje };
    }
    const puntaje = Math.round(mejor.puntaje);
    return {
      region_id: comuna.region_id, nombre: comuna.nombre, region: comuna.region,
      dia: mejor.dia, puntaje, aportes: mejor.aportes,
      nivel: puntaje >= CORTE_PRIORIDAD.alerta ? "alerta" : puntaje >= CORTE_PRIORIDAD.atencion ? "atencion" : "seguimiento",
      personas, puntos: puntosPorComuna[comuna.region_id] || [],
      // los dos factores que más empujan, para decir el porqué en una frase
      porque: [...mejor.aportes].sort((a, b) => b.puntos - a.puntos).slice(0, 2).map((a) => a.nombre.toLowerCase()),
    };
  });
  filas.sort((a, b) => b.puntaje - a.puntaje || b.personas - a.personas);
  return filas;
}

// ---------- alertas: lo que se manda al teléfono y por WhatsApp ----------

const valorEnTexto = (p, v) =>
  p.variable === "prob_foco" ? `probabilidad de foco ${Math.round(v * 100)} %`
    : p.variable === "pm25_humo" ? `humo ${String(Math.round(v))} µg/m³`
      : `alza respiratoria ${String(v).replace(".", ",")} %`;
const cuandoEnTexto = (d) => (d.dia === 1 ? "mañana" : d.dia === 2 ? "pasado mañana" : `el ${d.fecha.slice(8, 10)}-${d.fecha.slice(5, 7)}`);

/**
 * Una alerta por punto con acciones por hacer (activación o preparación), con la prioridad de su comuna.
 * El id cambia si cambia el estado o el día: así el teléfono sabe cuándo una alerta es nueva.
 */
export function alertas(avisos, prioridad) {
  const prioPorComuna = Object.fromEntries(prioridad.map((f) => [f.region_id, f]));
  const porPunto = {};
  for (const a of avisos) {
    if (a.estado === "vigilancia") continue;
    const actual = porPunto[a.punto.id];
    if (!actual) porPunto[a.punto.id] = { estado: a.estado, dia: a.dia, punto: a.punto, motivos: [a] };
    else {
      if (ORDEN_ESTADO[a.estado] < ORDEN_ESTADO[actual.estado]) { actual.estado = a.estado; actual.dia = a.dia; }
      actual.motivos.push(a);
    }
  }
  const lista = Object.values(porPunto).map((g) => {
    const propios = g.motivos.filter((m) => m.estado === g.estado);
    const prio = prioPorComuna[g.punto.region_id];
    return {
      id: `${g.punto.id}|${g.estado}|${g.dia.fecha}`,
      estado: g.estado,
      titulo: `${NOMBRE_ESTADO[g.estado]}: ${g.punto.nombre}`,
      motivo: propios.map((m) => `${cuandoEnTexto(m.dia)}, ${valorEnTexto(m.protocolo, m.valor)}`).map((t) => t[0].toUpperCase() + t.slice(1)).join(". "),
      confianza: g.dia.confianza,
      punto: { id: g.punto.id, nombre: g.punto.nombre, comuna: g.punto.comuna, region_id: g.punto.region_id, personas: g.punto.personas, responsable: g.punto.responsable },
      prioridad: prio ? prio.puntaje : 0,
      nivel_prioridad: prio ? prio.nivel : "seguimiento",
      acciones: propios.flatMap((m) => m.acciones.map((ac, i) => ({ clave: `${m.id}|${i}`, texto: ac.texto, quien: ac.quien, protocolo: m.protocolo.nombre }))),
      frenos: [...new Set(propios.map((m) => m.protocolo.freno))],
    };
  });
  lista.sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.prioridad - a.prioridad || b.punto.personas - a.punto.personas);
  return lista;
}

/** El parte en texto plano, para WhatsApp o correo. Sin formato que dependa de la aplicación. */
export function textoParte(listaAlertas, { fecha = "", ejemplo = false, maximo = 6 } = {}) {
  const act = listaAlertas.filter((a) => a.estado === "activacion");
  const prep = listaAlertas.filter((a) => a.estado === "preparacion");
  const bloque = (titulo, lista) => {
    if (!lista.length) return [];
    const filas = lista.slice(0, maximo).flatMap((a) => [
      `- ${a.punto.nombre} (${a.punto.comuna}, ${a.punto.personas} personas). ${a.motivo}. Confianza ${a.confianza}.`,
      ...a.acciones.map((ac) => `   · ${ac.texto} [${ac.quien}]`),
    ]);
    const resto = lista.length > maximo ? [`  y ${lista.length - maximo} más en la plataforma.`] : [];
    return [`${titulo} (${lista.length})`, ...filas, ...resto, ""];
  };
  const lineas = [
    `Preaviso, parte${fecha ? ` del ${fecha}` : ""}`,
    ...(ejemplo ? ["MAQUETA: datos inventados, no es un pronóstico real.", ""] : [""]),
    ...bloque("ACTIVAR HOY", act),
    ...bloque("PREPARAR HOY", prep),
    ...(act.length + prep.length ? [] : ["Hoy no hay acciones por activar ni preparar con los umbrales actuales.", ""]),
    "El aviso se levanta si el pronóstico baja del umbral.",
  ];
  return lineas.join("\n");
}

// ---------- historia de focos de una comuna ----------

export const SERIES = {
  armonizado: { nombre: "Armonizada", valor: (r) => r.armonizado },
  crudo: { nombre: "Sin armonizar", valor: (r) => (r.modis == null && r.viirs == null ? null : (r.modis ?? 0) + (r.viirs ?? 0)) },
  modis: { nombre: "MODIS crudo", valor: (r) => r.modis },
  viirs: { nombre: "VIIRS crudo", valor: (r) => r.viirs },
};

const mediana = (xs) => {
  const s = xs.filter((v) => v != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Mediana de la serie armonizada por mes. Solo se usa si el archivo no trae mediana_historica (contrato 0.1). */
export function medianaPorMes(registros) {
  const porMes = {};
  for (const r of registros) (porMes[r.mes] ||= []).push(r.armonizado);
  return Object.fromEntries(Object.entries(porMes).map(([m, xs]) => [m, mediana(xs)]));
}

/** El último mes con dato contra un mes normal de esa comuna. */
export function contraLoNormal(registros) {
  const ultimo = [...registros].reverse().find((r) => r.armonizado != null);
  if (!ultimo) return null;
  const normal = ultimo.mediana_historica ?? medianaPorMes(registros)[ultimo.mes];
  return { registro: ultimo, normal, veces: normal ? ultimo.armonizado / normal : null };
}

/** Cortes de color por cuantiles de los valores mayores que cero (hay muchos meses en cero y pocos enormes). */
export function cortesPorCuantil(valores, clases = 6) {
  const s = valores.filter((v) => v != null && v > 0).sort((a, b) => a - b);
  if (!s.length) return [];
  return Array.from({ length: clases - 1 }, (_, i) => s[Math.min(s.length - 1, Math.floor(((i + 1) * s.length) / clases))]);
}

/** Clase de color: 0 es "sin focos", 1 a N según los cortes. */
export function claseDeValor(v, cortes) {
  if (v == null) return "nd";
  if (v <= 0) return 0;
  let c = 1;
  for (const corte of cortes) if (v > corte) c += 1;
  return c;
}

export function totalPorAnio(registros, serie = "armonizado") {
  const f = SERIES[serie].valor;
  const tot = {};
  for (const r of registros) {
    const v = f(r);
    if (v == null) { tot[r.anio] ??= null; continue; }
    tot[r.anio] = (tot[r.anio] ?? 0) + v;
  }
  return Object.entries(tot).map(([anio, total]) => ({ anio: Number(anio), total }));
}

/** Filtra el CSV de focos por rango de años. La primera columna es la fecha (AAAA-MM-DD). */
export function filtrarCsvPorAnios(texto, desde, hasta) {
  const [cab, ...filas] = texto.trim().split(/\r?\n/);
  const dentro = filas.filter((f) => { const a = Number(f.slice(0, 4)); return a >= desde && a <= hasta; });
  return { texto: [cab, ...dentro].join("\n") + "\n", filas: dentro.length, total: filas.length };
}

// ---------- registro: qué umbral conviene mover ----------

/** Si un protocolo acumula muchas falsas alarmas o focos sin aviso, lo dice. Mínimo 4 casos para opinar. */
export function sugerenciasDeUmbral(registro, minimo = 4) {
  const porProtocolo = {};
  for (const f of registro) {
    const g = (porProtocolo[f.protocolo] ||= { acierto: 0, falsa_alarma: 0, sin_aviso: 0, total: 0 });
    g[f.resultado] += 1; g.total += 1;
  }
  const salida = [];
  for (const [protocolo, g] of Object.entries(porProtocolo)) {
    if (g.total < minimo) continue;
    const avisados = g.acierto + g.falsa_alarma;
    if (avisados && g.falsa_alarma / avisados >= 0.4) salida.push({ protocolo, tipo: "subir", casos: g.falsa_alarma, de: avisados });
    else if (g.sin_aviso / g.total >= 0.25) salida.push({ protocolo, tipo: "bajar", casos: g.sin_aviso, de: g.total });
  }
  return salida;
}

// ---------- contraste: nuestro motor al lado de las fuentes públicas ----------

const AVISA = (nivel) => nivel === "alto" || nivel === "muy_alto";

/** Para un día del pronóstico: en qué comunas coinciden o difieren el motor y las fuentes públicas. */
export function contrasteDelDia(pronostico, nDia) {
  return pronostico.items.filter((it) => it.dias[nDia - 1]?.externas).map((it) => {
    const d = it.dias[nDia - 1];
    const motor = AVISA(d.nivel);
    const otras = AVISA(d.externas.gwis) || d.externas.boton_rojo;
    return {
      region_id: it.region_id, nombre: it.nombre, motor: d.nivel, gwis: d.externas.gwis, boton_rojo: d.externas.boton_rojo,
      lectura: motor && otras ? "coinciden" : motor ? "solo_motor" : otras ? "solo_publicas" : "ninguna",
    };
  });
}

/** Días pasados: de cada fuente, cuántos avisos tuvieron foco, cuántos no, y cuántos focos llegaron sin aviso. */
export function aciertoPorFuente(contraste) {
  const fuentes = { motor: (d) => AVISA(d.motor), gwis: (d) => AVISA(d.gwis), boton_rojo: (d) => d.boton_rojo };
  const res = Object.fromEntries(Object.keys(fuentes).map((k) => [k, { avisos: 0, aciertos: 0, falsas: 0, sin_aviso: 0, dias_con_foco: 0 }]));
  for (const it of contraste.items) for (const d of it.dias) {
    const hubo = d.focos_observados > 0;
    for (const [k, avisa] of Object.entries(fuentes)) {
      const r = res[k];
      if (hubo) r.dias_con_foco += 1;
      if (avisa(d)) { r.avisos += 1; hubo ? (r.aciertos += 1) : (r.falsas += 1); } else if (hubo) r.sin_aviso += 1;
    }
  }
  return res;
}
