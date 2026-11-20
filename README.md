# Preaviso · AIVital (NASA Space Apps 2026)

Sitio publicado del front: riesgo de incendio por comuna a 24 h, 48 h y 7 días, incendios activos del satélite con su
zona probable de avance, sectores de 1 km del piloto de la Región de Valparaíso y qué hacer en cada comuna.

- Portada (sala de despacho): `index.html` · Plataforma por país, región y comuna: `plataforma.html`
- Código fuente del front: https://github.com/RemLover68/aivital-nasa-2026-front (carpeta `web/`, commit 8e4d8ba)
- Código del back: https://github.com/marcelo-corro/hackaton-nasa-2026-back
- Datos (back del equipo, contrato 0.8): https://marcelo-corro.github.io/hackaton-nasa-2026-datos/

La raíz de este repo es una copia de `web/` del front para servirla con GitHub Pages; no se edita aquí. Para
actualizarla, desde `NASA_SpaceApps` con el clon del front en `revision-front`: `bash aivital-preaviso/actualizar.sh`,
revisar `git -C aivital-preaviso status`, y hacer commit y push.

## Front nuevo (beta)

`preaviso/` es el rediseño en React (ver su README). Se publica en **/beta/**:
https://marcelo-corro.github.io/hackaton-nasa-2026-front/beta/

Cada push a `main` corre `.github/workflows/publicar.yml`: compila `preaviso/` (348 páginas: inicio, mapa y una por
comuna) y `.github/armar-sitio.sh` arma el sitio con lo actual en la raíz y lo nuevo en `/beta/`. Pages tiene que
estar con fuente "GitHub Actions". Para probar el sitio armado localmente:

```bash
cd preaviso && npm ci && BASE_PATH=/hackaton-nasa-2026-front/beta/ npm run build && cd ..
BASE_PATH=/hackaton-nasa-2026-front/beta/ bash .github/armar-sitio.sh /ruta/temporal/hackaton-nasa-2026-front
```

y servir `/ruta/temporal` con cualquier servidor estático (en Git Bash de Windows, anteponer `MSYS_NO_PATHCONV=1` a
la compilación).
