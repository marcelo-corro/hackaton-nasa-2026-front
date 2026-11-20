import type { Nivel } from "~/lib/esquemas";
import { cn, COLOR_NIVEL, NIVELES } from "~/lib/formato";

export function ChipNivel({ nivel, className }: { nivel: Nivel; className?: string }) {
  const c = COLOR_NIVEL[nivel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        c.fondo,
        c.texto,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.punto)} aria-hidden />
      {NIVELES[nivel].corto}
    </span>
  );
}

export function Tarjeta({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-3xl border border-borde/80 bg-superficie p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function TituloSeccion({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {accion}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-superficie-2", className)} />;
}

export function PuntoFuego({ className }: { className?: string }) {
  return (
    <span className={cn("pulso relative inline-block size-2.5 rounded-full bg-fuego text-fuego", className)} aria-hidden />
  );
}

export function PiePagina() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t border-borde px-4 py-8 text-xs leading-relaxed text-tinta-suave">
      <p>
        Apoyo a la decisión: la probabilidad no es una certeza ni una orden operativa, y Preaviso no emite alertas a la
        población. Ante un incendio, llama al 130 (CONAF), 132 (Bomberos) o 133 (Carabineros).
      </p>
      <p className="mt-2">
        Datos: focos de NASA FIRMS (VIIRS y MODIS) y clima de NASA POWER; límites comunales de la Biblioteca del Congreso
        Nacional. Proyecto NASA Space Apps Challenge 2026.{" "}
        <a className="underline hover:text-tinta" href="https://github.com/marcelo-corro/hackaton-nasa-2026-back">
          Metodología y código
        </a>{" "}
        ·{" "}
        {/* La primera versión del sitio queda publicada en /v1/ (ver .github/armar-sitio.sh); no es una ruta de la app. */}
        <a className="underline hover:text-tinta" href={`${import.meta.env.BASE_URL}v1/`}>
          Primera versión del sitio
        </a>
        .
      </p>
    </footer>
  );
}
