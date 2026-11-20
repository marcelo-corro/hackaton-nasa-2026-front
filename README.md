# Preaviso · AIVital (NASA Space Apps 2026)

Sitio publicado del front: riesgo de incendio por comuna a 24 h, 48 h y 7 días, incendios activos del satélite con su
zona probable de avance, sectores de 1 km del piloto de la Región de Valparaíso y qué hacer en cada comuna.

**https://marcelo-corro.github.io/hackaton-nasa-2026-front/**

- Código del back: https://github.com/marcelo-corro/hackaton-nasa-2026-back
- Datos (back del equipo, contrato 0.8): https://marcelo-corro.github.io/hackaton-nasa-2026-datos/

## Qué se publica

| Dirección | Contenido | Código |
|---|---|---|
| `/` | **Front nuevo** en React: inicio, ficha de cada comuna y mapa de Chile | `preaviso/` (ver su README) |
| `/v1/` | **Primera versión del sitio**: portada (sala de despacho) `index.html` y plataforma por país, región y comuna `plataforma.html` | La raíz de este repo |

El front nuevo estuvo en `/beta/` hasta el 20-11-2026, y en la raíz estaba la primera versión. Los enlaces viejos
siguen funcionando: `/beta/...` lleva a la misma página en la raíz (`preaviso/public/404.html`), `plataforma.html#comuna=05109`
abre esa comuna en el mapa nuevo, y `producto.html` y `movil.html` llevan a su página en `/v1/`.

## Primera versión (`/v1/`)

La raíz de este repo es una copia de `web/` del front de https://github.com/RemLover68/aivital-nasa-2026-front
(commit 8e4d8ba); no se edita aquí. Para actualizarla, desde `NASA_SpaceApps` con el clon de ese front en
`revision-front`: `bash aivital-preaviso/actualizar.sh`, revisar `git -C aivital-preaviso status`, y hacer commit y
push.

## Publicación

Cada push a `main` corre `.github/workflows/publicar.yml`: compila `preaviso/` (347 páginas: inicio, mapa y una por
comuna) y `.github/armar-sitio.sh` arma el sitio con el front nuevo en la raíz y la primera versión en `/v1/`. Pages
tiene que estar con fuente "GitHub Actions". Para probar el sitio armado localmente:

```bash
cd preaviso && npm ci && BASE_PATH=/hackaton-nasa-2026-front/ npm run build && cd ..
BASE_PATH=/hackaton-nasa-2026-front/ bash .github/armar-sitio.sh /ruta/temporal/hackaton-nasa-2026-front
```

y servir `/ruta/temporal` con cualquier servidor estático (en Git Bash de Windows, anteponer `MSYS_NO_PATHCONV=1` a
la compilación).
