import { BookOpenCheck, Database, ExternalLink, Flame, Monitor, Orbit, Presentation, Satellite, Sprout } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { PiePagina, Tarjeta } from "~/componentes/Basicos";
import { Encabezado } from "~/componentes/Encabezado";
import type { Route } from "./+types/quienes-somos";

export const meta: Route.MetaFunction = () => [
  { title: "Quiénes somos · Preaviso" },
  {
    name: "description",
    content:
      "El equipo detrás de Preaviso, proyecto del NASA Space Apps Challenge 2026 (desafío Harmonization of MODIS and VIIRS Hot Spots).",
  },
];

type Integrante = {
  nombre: string;
  rol: string;
  aporte: string;
  formacion: string;
  github?: string;
  acento: string;
};

// Todas las tarjetas tienen el mismo formato y extensión, y van por orden alfabético de apellido.
// Borrador: cada integrante debería revisar su propia descripción antes de publicarla.
const EQUIPO: Integrante[] = [
  {
    nombre: "Marcelo Corro",
    rol: "Software y datos · Coordinación técnica",
    aporte: "Desarrolla los modelos de riesgo, el procesamiento de datos y el sitio, y coordina la parte técnica.",
    formacion: "Ingeniero en Informática; cursa el Magíster en Ciencia de Datos e Inteligencia Artificial.",
    github: "marcelo-corro",
    acento: "from-marca to-bajo",
  },
  {
    nombre: "José De Los Santos",
    rol: "Interfaz y presentación",
    aporte: "Creó la primera versión de la interfaz del sitio y preparó la presentación del proyecto.",
    formacion: "Ingeniero Civil Industrial.",
    github: "RemLover68",
    acento: "from-medio to-alto",
  },
  {
    nombre: "Katherine González",
    rol: "Investigación",
    aporte: "Investigó fuentes de datos y verificó las recomendaciones oficiales contra sus documentos originales.",
    formacion: "Formación en Educación de Párvulos, con una gran pasión por el espacio.",
    acento: "from-fuego to-muyalto",
  },
  {
    nombre: "Sebastián Ríos",
    rol: "Investigación",
    aporte: "Investigó fuentes de datos y verificó las recomendaciones oficiales contra sus documentos originales.",
    formacion: "Ingeniero Civil Eléctrico.",
    acento: "from-bajo to-medio",
  },
  {
    nombre: "David Serrudo",
    rol: "Software y datos",
    aporte: "Aporta al desarrollo del back, del front y de la publicación de los datos; rediseñó la portada del sitio.",
    formacion: "Estudiante de último año de Ciencias de la Computación (Perú).",
    github: "Daavidasc",
    acento: "from-marca to-fuego",
  },
];

// Quién trabaja en cada parte. Cuando alguien se suma a un área, basta con agregar su nombre aquí.
const AREAS = [
  {
    icono: Database,
    titulo: "Datos y modelos",
    texto: "Descargar y armonizar los focos de calor, calcular el riesgo y publicar los datos cada mañana.",
    personas: ["Marcelo", "David"],
  },
  {
    icono: Monitor,
    titulo: "Sitio web",
    texto: "La app que muestra el riesgo de cada comuna, el mapa y qué hacer.",
    personas: ["Marcelo", "David", "José"],
  },
  {
    icono: BookOpenCheck,
    titulo: "Investigación",
    texto: "Las fuentes de datos y el respaldo de cada recomendación en documentos oficiales.",
    personas: ["Katherine", "Sebastián"],
  },
  {
    icono: Presentation,
    titulo: "Presentación",
    texto: "Cómo contamos el proyecto ante el jurado del hackatón.",
    personas: ["José"],
  },
];

const HISTORIA = [
  {
    icono: Orbit,
    titulo: "Un fin de semana en el Space Apps",
    texto:
      "El equipo se formó en la sede Santiago del NASA Space Apps Challenge 2026, el 14 y 15 de noviembre. Llegamos desde la informática, la ingeniería y la educación, con algo en común: las ganas de usar datos espaciales para algo útil en Chile.",
  },
  {
    icono: Satellite,
    titulo: "El desafío",
    texto:
      "Elegimos «Harmonization of MODIS and VIIRS Hot Spots», propuesto por la CONAE: unir en una sola serie comparable los focos de calor que detectan dos generaciones de satélites, MODIS (desde 2000) y VIIRS (desde 2012).",
  },
  {
    icono: Flame,
    titulo: "Qué construimos",
    texto:
      "Con esa serie armonizada nació Preaviso: estima cada día la probabilidad de incendio en las 345 comunas de Chile para mañana, 48 horas y 7 días, muestra los incendios activos con su zona probable de avance y dice qué hacer en cada comuna, citando fuentes oficiales.",
  },
  {
    icono: Sprout,
    titulo: "Y seguimos",
    texto:
      "Después del hackatón seguimos puliendo la idea entre todos. Los roles no son fijos: cada uno puede sumarse a otras áreas para aprender y aportar.",
  },
];

// Iniciales del nombre y del primer apellido ("José De Los Santos" → "JD").
const iniciales = (n: string) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export default function QuienesSomos() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-5xl px-4">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl pb-10 pt-14 text-center sm:pt-20"
        >
          <p className="text-sm font-medium text-tinta-suave">Proyecto NASA Space Apps Challenge 2026</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Quiénes somos</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-tinta-suave sm:text-lg">
            Cinco personas con formaciones distintas que se juntaron en un hackatón para anticipar los incendios en
            Chile con datos de satélite.
          </p>
        </motion.section>

        <div className="grid gap-4 sm:grid-cols-2">
          {HISTORIA.map(({ icono: Icono, titulo, texto }) => (
            <Tarjeta key={titulo}>
              <span className="grid size-10 place-items-center rounded-2xl bg-superficie-2 text-tinta-suave">
                <Icono className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{titulo}</h2>
              <p className="mt-2 leading-relaxed text-tinta-suave">{texto}</p>
            </Tarjeta>
          ))}
        </div>

        <div className="mb-5 mt-14 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">El equipo</h2>
          <p className="text-sm text-tinta-suave">Por orden alfabético de apellido</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPO.map((p, i) => (
            <motion.div
              key={p.nombre}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col rounded-3xl border border-borde/80 bg-superficie p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-base font-semibold text-white ${p.acento}`}
                  aria-hidden
                >
                  {iniciales(p.nombre)}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight">{p.nombre}</p>
                  <p className="text-sm text-tinta-suave">{p.rol}</p>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed">{p.aporte}</p>
              <p className="mt-3 text-sm leading-relaxed text-tinta-suave">{p.formacion}</p>
              {p.github && (
                <a
                  href={`https://github.com/${p.github}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-sm text-tinta-suave hover:text-marca"
                >
                  GitHub: {p.github} <ExternalLink className="size-3.5" />
                </a>
              )}
            </motion.div>
          ))}
        </div>

        <h2 className="mb-5 mt-14 text-2xl font-semibold tracking-tight">Cómo nos repartimos el trabajo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {AREAS.map(({ icono: Icono, titulo, texto, personas }) => (
            <Tarjeta key={titulo} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-tinta-suave">
                <Icono className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold tracking-tight">{titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-tinta-suave">{texto}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Integrantes en ${titulo}`}>
                  {personas.map((n) => (
                    <li key={n} className="rounded-full bg-superficie-2 px-2.5 py-0.5 text-xs font-medium">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </Tarjeta>
          ))}
        </div>

        <Tarjeta className="mt-14">
          <h2 className="text-lg font-semibold tracking-tight">Código y datos abiertos</h2>
          <p className="mt-2 leading-relaxed text-tinta-suave">
            Todo el proyecto es público: el{" "}
            <a className="text-marca hover:underline" href="https://github.com/marcelo-corro/hackaton-nasa-2026-back">
              back
            </a>{" "}
            (datos y modelos), los{" "}
            <a className="text-marca hover:underline" href="https://github.com/marcelo-corro/hackaton-nasa-2026-datos">
              datos publicados
            </a>{" "}
            y este{" "}
            <a className="text-marca hover:underline" href="https://github.com/marcelo-corro/hackaton-nasa-2026-front">
              sitio
            </a>
            . Los datos de base son de NASA FIRMS y NASA POWER, con el pronóstico del tiempo de Open-Meteo; las fuentes
            completas están en el back.
          </p>
          <Link to="/" className="mt-5 inline-block text-sm font-medium text-marca hover:underline">
            Volver al inicio
          </Link>
        </Tarjeta>
      </main>
      <PiePagina />
    </>
  );
}
