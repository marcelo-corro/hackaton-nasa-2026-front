// Ajustes al mapa base de OpenFreeMap una vez cargado.
import type { ExpressionSpecification, Map as MapaLibre } from "maplibre-gl";

const NOMBRE_ES: ExpressionSpecification = ["coalesce", ["get", "name:es"], ["get", "name:latin"], ["get", "name"]];

/** Nombres en español cuando OpenStreetMap los tiene (si no, el nombre local). */
export function nombresEnEspanol(mapa: MapaLibre) {
  for (const capa of mapa.getStyle().layers) {
    if (capa.type !== "symbol") continue;
    const texto = capa.layout?.["text-field"];
    if (texto && JSON.stringify(texto).includes("name:latin")) {
      mapa.setLayoutProperty(capa.id, "text-field", NOMBRE_ES);
    }
  }
}

/** Cierra el cuadro de créditos (MapLibre lo abre al cargar en modo compacto). */
export function cerrarCreditos(contenedor: HTMLElement) {
  contenedor.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
}

/** Todo lo que se hace al cargar un mapa: nombres, créditos e íconos. Devuelve la primera capa de nombres. */
export function prepararMapa(mapa: MapaLibre): string | undefined {
  nombresEnEspanol(mapa);
  cerrarCreditos(mapa.getContainer());
  return mapa.getStyle().layers.find((l) => l.type === "symbol")?.id;
}
