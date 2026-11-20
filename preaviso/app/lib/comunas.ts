import indice from "./comunas-indice.json";

export type ComunaIndice = {
  id: string;
  nombre: string;
  slug: string;
  region: string;
  codigoRegion: string;
  /** [oeste, sur, este, norte] */
  caja: [number, number, number, number];
};

export const COMUNAS = indice as ComunaIndice[];

const porId = new Map(COMUNAS.map((c) => [c.id, c]));
const porSlug = new Map(COMUNAS.map((c) => [c.slug, c]));

export const comunaPorId = (id: string) => porId.get(id);
export const comunaPorSlug = (slug: string) => porSlug.get(slug);

export const REGION_CORTA: Record<string, string> = {
  "15": "Arica y Parinacota",
  "01": "Tarapacá",
  "02": "Antofagasta",
  "03": "Atacama",
  "04": "Coquimbo",
  "05": "Valparaíso",
  "13": "Metropolitana",
  "06": "O'Higgins",
  "07": "Maule",
  "16": "Ñuble",
  "08": "Biobío",
  "09": "La Araucanía",
  "14": "Los Ríos",
  "10": "Los Lagos",
  "11": "Aysén",
  "12": "Magallanes",
};

export const regionCorta = (id: string) => REGION_CORTA[id.slice(0, 2)] ?? "";

export const normalizar = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca por nombre de comuna o de región, sin importar tildes ni mayúsculas. Primero las que empiezan igual. */
export function buscarComunas(texto: string, max = 8): ComunaIndice[] {
  const q = normalizar(texto);
  if (!q) return [];
  const empieza: ComunaIndice[] = [];
  const contiene: ComunaIndice[] = [];
  for (const c of COMUNAS) {
    const n = normalizar(c.nombre);
    if (n.startsWith(q)) empieza.push(c);
    else if (n.includes(q) || normalizar(regionCorta(c.id)).startsWith(q)) contiene.push(c);
  }
  return [...empieza, ...contiene].slice(0, max);
}
