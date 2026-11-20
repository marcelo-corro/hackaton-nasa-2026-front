import { Flame, Map as IconoMapa, Moon, Sun } from "lucide-react";
import { Link, NavLink } from "react-router";
import { cn } from "~/lib/formato";
import { useTema } from "~/lib/tema";
import { Buscador } from "./Buscador";

export function Encabezado({
  conBuscador = true,
  alElegirComuna,
}: {
  conBuscador?: boolean;
  alElegirComuna?: (id: string) => void;
}) {
  const [tema, cambiarTema] = useTema();
  return (
    <header className="sticky top-0 z-30 border-b border-borde/70 bg-fondo/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Preaviso, inicio">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-alto to-muyalto text-white shadow-sm">
            <Flame className="size-[18px]" strokeWidth={2.4} aria-hidden />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Preaviso</span>
        </Link>

        <div className="mx-auto w-full max-w-sm">
          {conBuscador && <Buscador compacto alElegir={alElegirComuna} />}
        </div>

        <nav className="flex shrink-0 items-center gap-1">
          <NavLink
            to="/mapa"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-tinta-suave transition hover:bg-superficie-2 hover:text-tinta",
                isActive && "bg-superficie-2 text-tinta",
              )
            }
          >
            <IconoMapa className="size-4" aria-hidden />
            <span className="hidden sm:inline">Mapa</span>
          </NavLink>
          <NavLink
            to="/quienes-somos"
            className={({ isActive }) =>
              cn(
                "hidden items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-tinta-suave transition hover:bg-superficie-2 hover:text-tinta md:flex",
                isActive && "bg-superficie-2 text-tinta",
              )
            }
          >
            Quiénes somos
          </NavLink>
          <button
            type="button"
            onClick={() => cambiarTema(tema === "oscuro" ? "claro" : "oscuro")}
            className="grid size-9 place-items-center rounded-lg text-tinta-suave transition hover:bg-superficie-2 hover:text-tinta"
            aria-label={tema === "oscuro" ? "Usar tema claro" : "Usar tema oscuro"}
          >
            {tema === "oscuro" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
