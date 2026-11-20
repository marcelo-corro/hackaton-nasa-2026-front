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

Cada push a `main` corre `.github/workflows/publicar.yml`: compila `preaviso/` (348 páginas: inicio, mapa, quiénes
somos y una por comuna) y `.github/armar-sitio.sh` arma el sitio con el front nuevo en la raíz y la primera versión en
`/v1/`. Pages tiene que estar con fuente "GitHub Actions". Para probar el sitio armado localmente:

```bash
cd preaviso && npm ci && BASE_PATH=/hackaton-nasa-2026-front/ npm run build && cd ..
BASE_PATH=/hackaton-nasa-2026-front/ bash .github/armar-sitio.sh /ruta/temporal/hackaton-nasa-2026-front
```

y servir `/ruta/temporal` con cualquier servidor estático (en Git Bash de Windows, anteponer `MSYS_NO_PATHCONV=1` a
la compilación).

## Equipo

Proyecto del NASA Space Apps Challenge 2026 (sede Santiago), desafío *Harmonization of MODIS and VIIRS Hot Spots*.
Por orden alfabético de apellido:

| Integrante | Rol | GitHub |
|---|---|---|
| Marcelo Corro | Software y datos · coordinación técnica | [marcelo-corro](https://github.com/marcelo-corro) |
| José De Los Santos | Interfaz y presentación | [RemLover68](https://github.com/RemLover68) |
| Katherine González | Investigación | — |
| Sebastián Ríos | Investigación | — |
| David Serrudo | Software y datos | [Daavidasc](https://github.com/Daavidasc) |

| Área | Integrantes |
|---|---|
| Datos y modelos (back) | Marcelo Corro, David Serrudo |
| Sitio web (front) | Marcelo Corro, David Serrudo, José De Los Santos |
| Investigación (fuentes de datos y respaldo de las recomendaciones) | Katherine González, Sebastián Ríos |
| Presentación | José De Los Santos |

La primera versión de la interfaz, la que hoy está en `/v1/`, la hizo José De Los Santos en su repo
[RemLover68/aivital-nasa-2026-front](https://github.com/RemLover68/aivital-nasa-2026-front); este es el repo oficial
del sitio. Los roles no son fijos: cada integrante puede sumarse a otras áreas para aprender y aportar. El detalle
de cada cambio al código está en el historial de commits y en
[Contributors](https://github.com/marcelo-corro/hackaton-nasa-2026-front/graphs/contributors). Más sobre el equipo
y la historia del proyecto en [Quiénes somos](https://marcelo-corro.github.io/hackaton-nasa-2026-front/quienes-somos).

## Licencia

El código está bajo licencia [MIT](LICENSE), con «Copyright (c) 2026 Los autores de Preaviso»: las personas de la
sección [Equipo](#equipo) y quienes se sumen después. `vendor/leaflet/` conserva su propia licencia (BSD 2-Clause).
Los datos que muestra el sitio vienen del [repo de datos](https://github.com/marcelo-corro/hackaton-nasa-2026-datos)
(CC BY 4.0, con sus fuentes), y los mapas base de OpenFreeMap y OpenStreetMap, con su atribución en el mapa.
