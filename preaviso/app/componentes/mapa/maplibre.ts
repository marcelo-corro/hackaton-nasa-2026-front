// MapLibre 6 busca su worker en "./maplibre-gl-worker.mjs" junto a su propio archivo. Al compilar, Vite
// renombra y mueve ese archivo, así que la ruta no existe y el mapa queda en blanco. Aquí se le pasa la URL
// del worker que Vite sí publica. Importar este módulo antes de crear un mapa.
import { setWorkerUrl } from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(urlWorker);
